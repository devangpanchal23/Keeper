import asyncio
import hmac
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from faster_whisper import WhisperModel

MODEL_NAME = os.getenv("WHISPER_MODEL", "large-v3")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
SERVICE_TOKEN = os.getenv("WHISPER_SERVICE_TOKEN", "")
MAX_UPLOAD_BYTES = int(os.getenv("WHISPER_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
MAX_CONCURRENT_JOBS = max(1, int(os.getenv("WHISPER_CONCURRENCY", "2")))

if not shutil.which("ffmpeg"):
    raise RuntimeError("ffmpeg is required to extract audio from video media.")
if not SERVICE_TOKEN:
    raise RuntimeError("WHISPER_SERVICE_TOKEN must be set before starting the service.")

model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
app = FastAPI(title="Keeper faster-whisper worker", docs_url=None, redoc_url=None)


def transcribe_media(media_bytes: bytes, suffix: str, language_hint: str | None) -> dict:
    with tempfile.TemporaryDirectory(prefix="keeper-whisper-") as temporary_directory:
        root = Path(temporary_directory)
        media_path = root / f"source{suffix}"
        audio_path = root / "audio.wav"
        media_path.write_bytes(media_bytes)
        extraction = subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(media_path),
             "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(audio_path)],
            capture_output=True, text=True, timeout=180, check=False,
        )
        if extraction.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
            raise ValueError("Audio could not be extracted from this media item.")

        segments, info = model.transcribe(str(audio_path), language=language_hint or None, vad_filter=True, beam_size=5)
        output_segments = []
        transcript_parts = []
        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            transcript_parts.append(text)
            output_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": text,
                "confidence": max(0.0, min(1.0, 1.0 + segment.avg_logprob / 5.0)),
            })
        return {"text": " ".join(transcript_parts), "language": info.language, "segments": output_segments}


def extract_audio(media_bytes: bytes, suffix: str) -> tuple[bytes, float]:
    with tempfile.TemporaryDirectory(prefix="keeper-audio-extraction-") as temporary_directory:
        root = Path(temporary_directory)
        media_path = root / f"source{suffix}"
        audio_path = root / "audio.m4a"
        media_path.write_bytes(media_bytes)
        extraction = subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(media_path),
             "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "64k", str(audio_path)],
            capture_output=True, text=True, timeout=180, check=False,
        )
        if extraction.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
            raise ValueError("Audio could not be extracted from this media item.")
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
            capture_output=True, text=True, timeout=30, check=False,
        )
        duration = float(probe.stdout.strip()) if probe.returncode == 0 and probe.stdout.strip() else 0.0
        return audio_path.read_bytes(), duration


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "model": MODEL_NAME, "device": DEVICE}


@app.post("/transcribe")
async def transcribe(request: Request) -> dict:
    if SERVICE_TOKEN:
        provided = request.headers.get("authorization", "")
        if not provided.startswith("Bearer ") or not hmac.compare_digest(provided[7:], SERVICE_TOKEN):
            raise HTTPException(status_code=401, detail="Unauthorized")

    content_length = int(request.headers.get("content-length", "0") or 0)
    if content_length > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Media exceeds the configured upload limit")

    media = bytearray()
    async for chunk in request.stream():
        media.extend(chunk)
        if len(media) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Media exceeds the configured upload limit")
    if not media:
        raise HTTPException(status_code=400, detail="Media request body is empty")

    mime_type = request.headers.get("x-media-mime-type", "application/octet-stream").split(";", 1)[0].lower()
    suffix = {"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
              "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav",
              "audio/x-wav": ".wav", "audio/ogg": ".ogg", "audio/webm": ".webm"}.get(mime_type, ".media")
    language_hint = request.headers.get("x-language-hint")

    async with semaphore:
        try:
            return await asyncio.to_thread(transcribe_media, bytes(media), suffix, language_hint)
        except subprocess.TimeoutExpired as error:
            raise HTTPException(status_code=422, detail="Audio extraction exceeded its time limit") from error
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=503, detail="Speech transcription failed") from error


@app.post("/extract-audio")
async def extract_audio_endpoint(request: Request):
    if SERVICE_TOKEN:
        provided = request.headers.get("authorization", "")
        if not provided.startswith("Bearer ") or not hmac.compare_digest(provided[7:], SERVICE_TOKEN):
            raise HTTPException(status_code=401, detail="Unauthorized")
    content_length = int(request.headers.get("content-length", "0") or 0)
    if content_length > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Media exceeds the configured upload limit")
    media = bytearray()
    async for chunk in request.stream():
        media.extend(chunk)
        if len(media) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Media exceeds the configured upload limit")
    if not media:
        raise HTTPException(status_code=400, detail="Media request body is empty")
    mime_type = request.headers.get("x-media-mime-type", "video/mp4").split(";", 1)[0].lower()
    suffix = {"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}.get(mime_type, ".media")
    async with semaphore:
        try:
            audio, duration = await asyncio.to_thread(extract_audio, bytes(media), suffix)
            from fastapi.responses import Response
            return Response(content=audio, media_type="audio/mp4", headers={"X-Audio-Duration-Seconds": str(duration)})
        except subprocess.TimeoutExpired as error:
            raise HTTPException(status_code=422, detail="Audio extraction exceeded its time limit") from error
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=503, detail="Audio extraction failed") from error
