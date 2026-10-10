# AI Media Architect

*Last Updated: 2026-10-07*

## Instagram preview resolver correction (2026-10-08)

Instagram provider thumbnails were validated and returned, then discarded because ingestion did not pass the canonical resolver's `hasAuthenticThumb` signal. Ingestion now derives that signal only from non-fallback provenance and a URL that passes media validation. Direct thumbnail URLs in official JSON exports are also accepted without requiring a ZIP archive callback. Embed/OpenGraph metadata can return an authentic image when caption/author fields are absent. This fixes exposed images; it cannot bypass guest access restrictions or fetch private media.

## Runtime flow

```text
authenticated single/bulk import
  -> server metadata normalization (no media transcription)
  -> keeper_import_media PostgreSQL transaction
       workspace URL deduplication + plan quota + Usage Ledger + AI job
  -> browser library copy for current UI compatibility
  -> GitHub Actions scheduler POSTs /api/ai/worker to claim leased jobs
  -> faster-whisper/platform-caption adapter + optional OCR service -> normalized representation
  -> grounded analysis/tag generation + evidence-based asset classification -> workspace collection matching
  -> transcript, analysis, item payload, workspace assignment memory
```

The authenticated Supabase account ID is the workspace ID. Row-level security filters data by `auth.uid()`. The service-role worker only processes jobs returned by the atomic `keeper_claim_ai_job()` function and always loads media with both its media ID and workspace ID.

Single and browser bulk imports call the same authenticated `/api/ingest` boundary. Legacy server-memory bulk-job start/retry routes are retired so they cannot bypass the ledger or durable queue; remaining create/status/control routes verify Supabase Auth and workspace ownership.

## Processing and retries

- Job status: `QUEUED`, `PENDING`, `EXTRACTING`, `TRANSCRIBING`, `ANALYZING`, `GENERATING_TAGS`, `MATCHING_COLLECTION`, `ORGANIZING`, `INDEXING`, `COMPLETED`, and stage-specific failures.
- A five-minute lease plus `FOR UPDATE SKIP LOCKED` prevents two workers from claiming the same job. The GitHub Actions scheduler requests a batch of three bounded parallel workers. Failed work retries with exponential delay and ends after five attempts.
- Transcript persistence is unique by `media_id`; retries reuse it. Analysis and item payloads use upserts/updates. Import rows and ledger entries are committed before AI work, so a failed model never removes a saved import.
- Canonical URL and platform identifier are unique per workspace. Strong normalized source-text fingerprints are checked before quota consumption as well. Duplicates do not consume another credit or create another job.
- Transcription/media caches require a workspace ID; unscoped callers do not share cached content.
- `TRANSCRIPTION_PROVIDER=auto|openai|faster-whisper` selects the server-side STT adapter. `auto` uses OpenAI when `OPENAI_TRANSCRIPTION_API_KEY` or `OPENAI_API_KEY` exists, otherwise the self-hosted faster-whisper service. OpenAI receives only audio; video must first be demuxed by the authenticated FFmpeg sidecar.
- Media that is inaccessible from an authorized source adapter is never guessed or fetched through anti-bot bypasses; it receives a retryable/failed job state with the actual access limitation.
- The current YouTube adapter returns oEmbed/Data API metadata only. The official YouTube Captions download API requires permission to edit the video; an API key or general account OAuth does not grant that permission for arbitrary public videos. Audio acquisition from arbitrary YouTube videos is not implemented.
- The current LinkedIn adapter does not have member OAuth/post permission integration; guest requests cannot fetch private post bodies. Instagram direct media requires the authorized Meta API/export path. These platform access gaps must be resolved before claiming universal real-URL completion.
- Media streams restricted by a source platform remain unavailable. Keeper does not bypass access controls; metadata and the saved item remain intact.

## Plan/credit rules

| Plan | Server limit | Cycle |
| --- | ---: | --- |
| Free | 30 successful unique imports | 7 days, anchored to the workspace's first import |
| Basic monthly | 220 imports | subscription period |
| Basic yearly | 2,640 imports | subscription period |
| Pro monthly/yearly | Unlimited imports | subscription period |

Prices remain ₹300/₹500 monthly and ₹3,500/₹5,500 yearly in `src/lib/billing-plans.ts`. `keeper_import_media` serializes quota checks per workspace and writes one auditable `keeper_usage_ledger` row per successful new media item. Retries and duplicate URLs consume no additional credit.

## Unified content intelligence

All source adapters stop at authoritative source data. `ContentIntelligenceService` normalizes it to one `contentRepresentation` (`type`, text, transcript, source, extraction method, confidence, status, timestamp, optional failure reason). A verified speech transcript wins; a platform caption track is marked `platform_transcript`; otherwise the best available post body, caption, description, or title is used. No unavailable transcript is replaced with generated text.

The grounded tagger uses only that normalized text, excludes platform labels, canonicalizes known aliases (for example `react.js` to `React`), stores short evidence snippets, and caps results at 8 by default. Confidence is a transparent deterministic heuristic, not a calibrated probability. AI summaries and provenance are persisted with the item. If transcription fails, source text remains analyzable and the transcript failure reason is kept in the representation.

`CollectionMatchingService` scores workspace collections using name/description/profile-term overlap, grounded tags, and a small explicit domain synonym map. Exact generated-topic phrases carry extra weight (for example, `After Effects` matches `After Effects Tutorials`). Scores are deterministic overlap heuristics, not probabilities. The strongest sufficiently relevant collection is applied; manual user assignments take precedence and are saved as workspace-scoped corrections. If no collection matches, a new collection may be created for one source-evidenced topic only when analysis confidence is at least 0.78 and the AI classifies the item as a reusable asset with score at least 0.72. Generic media/type labels cannot create collections. The AI workflow never deletes a collection.

`VisualTextService` can send already-acquired media bytes to the optional private OCR sidecar in `services/ocr`; OCR results include source method and sample count. OCR is unavailable until that sidecar is deployed and configured. The active worker uses the configured content model for asset classification and requires exact source excerpts to support it; the older rule-based classifier is not used for completed media analysis.

## Strict content gate and model provider

The import request stores source metadata and queues work only; it does not create AI tags, summaries, or collection decisions. The worker excludes titles from normalized analysis text. Video/reel/short items require a real speech transcript or verified platform caption track before analysis. Text posts require extracted post text/caption/description, and images require OCR or other verified source text. Missing evidence sets a stage-specific failure and is retryable from item detail.

Grounded analysis uses `ContentAnalysisService`, an OpenAI-compatible Chat Completions adapter. Set `CONTENT_AI_API_KEY`, `CONTENT_AI_MODEL`, and optionally `CONTENT_AI_API_URL`. Every returned tag, key point, and summary/asset citation must include an exact excerpt found in normalized source text; invalid output fails instead of falling back to title-derived content. No provider credentials are configured in this workspace, so analysis intentionally stops with a visible `ANALYSIS_FAILED` state until configured.

Reprocessing refreshes verified source metadata, preserves user tags and suppressed AI tags, then resets the existing durable job in place. Tag edits and collection changes are persisted through authenticated workspace-scoped routes. Search indexes normalized representation text alongside transcript, tags, summary, and metadata.

## Collections and workspace learning

Current workspace collections are synchronized from the authenticated import request into `keeper_collections`. Collection suggestions and decisions are stored in analysis JSON and item provenance. Manual collection moves call `/api/media/[id]/collection`, persist a correction, and future jobs use high-overlap correction terms as a workspace-specific signal. Collection profiles keep topic/tag terms; no vector extension or cross-workspace embedding index is used.

## Database migration

Apply `supabase/migrations/202610070001_ai_media_architect.sql`, `202610070002_keeper_collection_sync_grants.sql`, and `202610070003_universal_ai_reprocessing.sql` in order after the billing migration. They add workspace media, transcripts, analyses, collections/profiles, jobs, assignment history, corrections, usage ledger tables plus quota/claim/memory, collection sync, transcript history, reprocessing, and tag update RPCs. The migrations assume Supabase Auth and the existing `billing_subscriptions` table.

## Environment and scheduler

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `WHISPER_SERVICE_URL`, `WHISPER_SERVICE_TOKEN`, optional `WHISPER_MODEL` (`large-v3` default); the same sidecar exposes `/extract-audio` for OpenAI video transcription.
- `TRANSCRIPTION_PROVIDER`, `OPENAI_TRANSCRIPTION_API_KEY` (or `OPENAI_API_KEY`), optional `OPENAI_TRANSCRIPTION_MODEL` (`whisper-1` default), optional `AUDIO_EXTRACTION_SERVICE_URL`
- `CONTENT_AI_API_KEY` (or shared `OPENAI_API_KEY`), `CONTENT_AI_MODEL`, optional `CONTENT_AI_API_URL` (OpenAI-compatible analysis endpoint; server-side only)
- Optional OCR: `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN` (deploy `services/ocr` privately; text-only imports do not require it)
- `AI_WORKER_SECRET` for authenticated `/api/ai/worker` calls
- `.github/workflows/ai-worker.yml` invokes the worker using authenticated POST requests every five minutes, which fits Vercel Hobby's once-per-day Cron limit. Add the same `AI_WORKER_SECRET` value to Vercel Production and GitHub Actions Secrets, and set the GitHub Actions variable `PRODUCTION_APP_URL` to the production HTTPS URL. GitHub scheduled workflows are best-effort and may be delayed; use Vercel Pro or a dedicated scheduler if tighter processing latency is required.

The faster-whisper service accepts authenticated `application/octet-stream` media at `/transcribe` and returns `text`, optional `language`, and `segments` using `start`/`end` seconds. `/extract-audio` uses FFmpeg and returns AAC audio in M4A plus duration metadata for OpenAI transcription. Both endpoints enforce upload limits. Transcript timing/duration/provenance requires applying `supabase/migrations/202610070004_transcript_audio_metadata.sql` after the earlier AI migrations. The adapter interface remains replaceable through `TranscriptionService.setProvider`.

Analysis now accepts a typed `ContentRepresentation`, and rejects title, metadata-only, and incomplete inputs at the service boundary. Legacy reprocessing/organization code must preserve the same gate: only trusted transcript providers or completed normalized source text/OCR can influence tags and collection matching. On processing failure, stale AI fields/index entries and AI-assigned collection links are cleared; user tags/manual collection links remain.

## Root causes addressed

1. `IngestionService.processUrl` acquired/transcribed media inline. Slow transcription therefore extended the import request. It now stops after metadata enrichment; durable jobs perform media processing later.
2. The old default speech provider decoded arbitrary bytes as natural-language transcript, and an API-key check could report a successful empty Whisper result. Both paths were removed; only a configured Whisper service can return a transcript.
3. Transcript and media caches previously used globally keyed content IDs. They now include workspace IDs, and unscoped data is not cached.
4. Quotas were localStorage-only and bulk workers could update them outside a transaction. Authenticated imports now go through an atomic database quota/dedup/ledger/job transaction; browser bulk imports use this endpoint.
5. The metadata preview and organizer inferred tags/topics from platform labels and fixed topic branches. The shared content normalizer/tagger now derives persisted tags from grounded source text; the organizer delegates collection selection to the shared matcher.
6. Transcription failure previously retried/faulted the full job even when a caption or post body was available. Failed transcription is now recorded and the job continues with available source text.

## Verification

- Regression assertions added to `scripts/run-tests.ts` for unavailable transcription, representation provenance, grounded platform-independent tags, semantic collection matching, evidence-based asset classification, and OCR line deduplication. `npm test` could not execute because the project invokes `tsx` via `npx` and it is not installed or cached; the environment cannot fetch it (`ENOTCACHED`).
- `npm run type-check`: passes.
- Focused ESLint on changed pipeline/UI/API files: 0 errors (existing warnings remain). Full `npm run lint` reports repository errors and warnings, including nested `.kilo/worktrees` and legacy test-runner violations.
- `npm run build`: blocked because `next/font` could not fetch Geist from `fonts.googleapis.com` in the network-restricted environment.

## Production limitations to verify before launch

- Apply all Supabase migrations in the documented order and configure Supabase Auth, Razorpay webhooks, the service-role key, a reachable faster-whisper deployment, and the matching Vercel/GitHub `AI_WORKER_SECRET`. These external systems were not available here, so live SQL/Razorpay/Whisper workflows have not been exercised.
- Keeper still uses per-user localStorage for legacy items and many library mutations. Authenticated workspace startup hydrates server-imported media from Supabase and merges AI-derived fields safely, but existing local-only items and all subsequent library edits are not yet fully synchronized to Postgres.
- Platform providers may not expose a downloadable audio stream. Such media is retained with metadata and a truthful unavailable transcript; platform authorization or user-provided media is needed for transcription.
- OCR requires deploying the optional private Tesseract/FFmpeg sidecar and configuring its URL/token. Coverage also depends on the adapter being able to acquire the source media legitimately.
- Current YouTube acquisition requires authorized media/caption access; Instagram guest extraction cannot download audio and LinkedIn guest extraction is login-restricted. These sources must fail explicitly unless an authorized adapter or source-provided transcript/text is available. Real-URL E2E tests were not possible here.
- Live end-to-end platform imports, Supabase RPC/migration execution, and transcript worker execution were not verified in this environment. Run the listed migrations, configure a reachable Whisper service and scheduler, then exercise source providers with authorized URLs before launch.
- Similarity uses current workspace text/topic profiles and correction overlap, not vector embeddings. Add `pgvector` only if measured matching quality warrants it.
