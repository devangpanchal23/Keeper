# Keeper OCR service

Free-first, self-hosted OCR adapter for images and video frames. The service accepts a raw image/video request body and returns JSON `{ text, lines, confidence, sampleCount }`. Images are processed with Tesseract; videos are sampled with FFmpeg at one frame every ten seconds, capped at eight frames. Repeated lines are deduplicated.

Run locally or deploy privately:

```sh
docker build -t keeper-ocr services/ocr
docker run --rm -p 8001:8001 -e OCR_SERVICE_TOKEN='replace-with-a-long-random-secret' keeper-ocr
```

Configure the Next.js server with `OCR_SERVICE_URL` pointing at this trusted service and the same `OCR_SERVICE_TOKEN`. Keep it private behind TLS/network policy. Request size is capped at 25 MB; no source URL is passed to this service, only bytes already fetched through Keeper's HTTPS media acquisition checks.
