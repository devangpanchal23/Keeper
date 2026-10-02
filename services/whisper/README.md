# Keeper faster-whisper service

Private CPU-first transcription sidecar. It uses faster-whisper/CTranslate2, VAD filtering, and ffmpeg to extract mono 16 kHz audio from videos before inference. The Next.js worker only sends a bounded media byte stream; heavy decoding and model inference stay outside the import request/runtime.

## Run with Docker

```sh
docker build -t keeper-whisper services/whisper
docker run --rm -p 8000:8000 \
  -e WHISPER_SERVICE_TOKEN='use-a-long-random-secret' \
  -e WHISPER_MODEL=large-v3 \
  -e WHISPER_CONCURRENCY=2 \
  keeper-whisper
```

Configure the app with the private service URL (for example `http://keeper-whisper:8000/transcribe`) and the same `WHISPER_SERVICE_TOKEN`. Keep the service behind private networking or an authenticated gateway; never publish it as an unauthenticated public endpoint.

Model weights are downloaded by faster-whisper on first startup. CPU uses `int8` by default; choose an appropriate GPU image/device and `WHISPER_COMPUTE_TYPE` for larger deployments. Configure memory/CPU, `WHISPER_MAX_UPLOAD_BYTES` (default 100 MiB), and `WHISPER_CONCURRENCY` based on available hardware. Media is written to a temporary directory and deleted after the request. Do not mount that directory persistently.

## API contract

- `POST /transcribe`: raw bytes, `Content-Type: application/octet-stream`, `X-Media-Mime-Type`, optional `X-Language-Hint`, and `Authorization: Bearer <WHISPER_SERVICE_TOKEN>`.
- `POST /extract-audio`: authenticated raw video bytes and `X-Media-Mime-Type`; extracts mono 16 kHz AAC/M4A with FFmpeg and returns audio bytes plus `X-Audio-Duration-Seconds`. This endpoint is used when `TRANSCRIPTION_PROVIDER=openai` because OpenAI receives audio, not video.
- Successful JSON: `{ text, language, segments: [{ start, end, text, confidence }] }` where times are seconds.
- Empty/silent audio returns an empty transcript; unextractable audio and transient inference errors return non-2xx responses for Keeper's bounded retry policy.
- `GET /health` reports model/device readiness without exposing credentials.

The app selects OpenAI transcription in server runtime with `TRANSCRIPTION_PROVIDER=openai` and `OPENAI_TRANSCRIPTION_API_KEY` (or `OPENAI_API_KEY`). `whisper-1` is the default model and returns verbose JSON with segments; other supported models can be selected with `OPENAI_TRANSCRIPTION_MODEL`. OpenAI upload size is limited to 25 MiB by the app adapter.
