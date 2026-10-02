import io
import os
import subprocess
import tempfile
from pathlib import Path

import pytesseract
from fastapi import FastAPI, Header, HTTPException, Request
from PIL import Image, ImageOps

app = FastAPI(title="Keeper OCR", docs_url=None, redoc_url=None)
MAX_BYTES = 25 * 1024 * 1024
TOKEN = os.getenv("OCR_SERVICE_TOKEN", "")


def authorize(authorization: str | None) -> None:
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def read_image(image_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image)
    image.thumbnail((2400, 2400))
    return image.convert("RGB")


def ocr_image(image: Image.Image) -> tuple[str, float]:
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    words: list[str] = []
    confidences: list[float] = []
    for word, confidence in zip(data["text"], data["conf"]):
        word = word.strip()
        try:
            score = float(confidence)
        except (TypeError, ValueError):
            continue
        if word and score >= 0:
            words.append(word)
            confidences.append(score / 100)
    return " ".join(words), sum(confidences) / len(confidences) if confidences else 0.0


@app.post("/")
async def extract(request: Request, authorization: str | None = Header(default=None)):
    authorize(authorization)
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Empty OCR input")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Input exceeds 25 MB")

    content_type = request.headers.get("content-type", "application/octet-stream").lower()
    if content_type.startswith("image/"):
        text, confidence = ocr_image(read_image(data))
        lines = [line.strip() for line in text.splitlines() if line.strip()] or ([text] if text else [])
        return {"text": text, "lines": lines, "confidence": confidence, "sampleCount": 1}

    # Videos are sampled at most every 10 seconds, capped at 8 frames.
    with tempfile.TemporaryDirectory(prefix="keeper-ocr-") as directory:
        source = Path(directory) / "source-media"
        source.write_bytes(data)
        pattern = Path(directory) / "frame-%02d.jpg"
        try:
            subprocess.run(
                ["ffmpeg", "-v", "error", "-i", str(source), "-vf", "fps=1/10,scale='min(1600,iw)':-2", "-frames:v", "8", str(pattern)],
                check=True, timeout=90, capture_output=True,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            raise HTTPException(status_code=422, detail="Video frames could not be extracted") from error
        frames = sorted(Path(directory).glob("frame-*.jpg"))
        if not frames:
            raise HTTPException(status_code=422, detail="No video frames were available")
        seen: set[str] = set()
        lines: list[str] = []
        scores: list[float] = []
        for frame in frames:
            text, confidence = ocr_image(read_image(frame.read_bytes()))
            scores.append(confidence)
            for line in text.splitlines():
                clean = " ".join(line.split())
                key = clean.casefold()
                if len(clean) > 3 and key not in seen:
                    seen.add(key)
                    lines.append(clean)
        return {"text": "\n".join(lines), "lines": lines, "confidence": sum(scores) / len(scores), "sampleCount": len(frames)}
