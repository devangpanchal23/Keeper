# Keeper Phase 0 — Feature Inventory

Status labels describe repository implementation; “verified” means supported by source inspection and/or the local test suite, not by a live production integration.

## Existing product functionality

| Area | Status | Evidence and boundary |
|---|---|---|
| Single URL import | Implemented, partially verified | `src/app/api/ingest/route.ts`, `src/services/ingestion-service.ts`, provider registry and platform adapters. Live provider access is environment/platform dependent. |
| Instagram post/Reel URL import | Implemented, partially verified | Instagram provider and media preview resolvers; export metadata and authentic thumbnails are preserved when available. Guest access is often restricted; no universal media access. |
| Bulk import | Implemented and locally verified | Instagram JSON/ZIP export and YouTube CSV/URL list parsing; job stages, progress, retries, reports, duplicate policy and “Locate in Keeper”; tests cover 1,000 candidates and canonical saved IDs. OAuth capability routes exist but integrations report unsupported cases rather than claiming all platform APIs. |
| Duplicate prevention | Implemented, partial across modes | URL canonicalization and `ContentService.checkDuplicate`; server canonical URL/source identity uniqueness and payload-derived fingerprint lookup. Fingerprint is not similarity detection and short text yields no fingerprint. |
| Content extraction | Implemented, partially verified | Provider adapters for Instagram, YouTube, Reddit, LinkedIn, X, and generic web; platform access limitations are documented in `ai/PROVIDERS.md` and source. |
| Transcription | Implemented, configuration-dependent | `TranscriptionService`, media acquisition and worker; configurable Gemini/OpenAI/Deepgram/Whisper paths. No configured-provider or authorized source-stream proof from this checkout. |
| OCR | Implemented, configuration-dependent | `VisualTextService` calls configured OCR service; evidence integrated into representations. Sidecar/configuration required. |
| Source Text Analysis visibility | Implemented, locally verified | `shouldShowSourceTextAnalysis` in `src/lib/source-text-comparison.ts`, rendered in item detail; tests include duplicate/near-identical and meaningful-difference cases. Real extraction correctness remains provider-dependent. |
| Grounded summaries/tags/categories | Implemented, partially verified | `ContentAnalysisService` requires verified content and exact evidence excerpts; `AIPipeline` rejects title-only/incomplete content; worker persistence. Model accuracy and provider configuration not live-verified. |
| Dashboard/library/favorites/archive/trash/recent | Implemented, partially verified | Routes under `src/app/app`; context and local storage drive views. Server sync is incomplete for the whole library and some mutations. |
| Search | Implemented, locally verified as lexical | `SearchService` uses weighted fields, synonyms, token/plural/fuzzy matching. No DB full-text or vector index identified. 24-case assistant retrieval evaluation included in suite. |
| Collections | Implemented, partially verified | Collection service/context, server endpoints, multi-membership, profile/matching/correction data. Cross-device completeness depends on sync and database mode. |
| AI assistant | Implemented, partially verified | Assistant route/service uses saved text, source quote validation, optional configured model; local evidence fallback. No embeddings/RAG/vector index. |
| Assistant conversation history | Implemented, partially verified | Local user-scoped history and SQL migration/routes for cloud; migration is not confirmed applied. |
| Analytics | Incomplete | Dashboard shows computed library counts/ratios; no product event analytics or robust usage activity model. Vercel web analytics components are deployment dependent. |
| Settings/profile/auth | Implemented, partially verified | Supabase Auth routes and session handling; local/demo account compatibility remains. No live auth acceptance was run. |
| Subscriptions/usage entitlements | Open-source edition reports removed, residual code/schema remains | README presents free/unlimited OSS; billing API paths, Razorpay dependency, billing migration and standalone schema remain. Verify runtime behavior and packaging boundaries before declaring fully separated. |

## Import and AI state details

- Bulk item states are represented in `src/types/index.ts`; `ImportJobService` persists browser job/report data in localStorage and supports bounded worker concurrency, retryable failure classification, pause/resume/cancel, and report reconciliation.
- Durable AI states live separately in database job/media records. `keeper_ai_jobs` is unique per media item and idempotency key, with `available_at`, lease (`locked_until`), attempts, failure code/error, and status index. Worker retry policy is capped and has stage-specific failure metadata.
- Ingestion persists the source item before AI completion. A provider or AI failure is intended to preserve the bookmark and record an explicit incomplete/failure state.
- No user-facing durable inbox/review queue beyond per-item status, detail view, bulk reports, and historical report UI was identified.

## Eight planned AI features

### A. Smart Inbox — **Medium**

- **Existing:** Import reports, per-item import statuses, durable AI jobs, retry state, worker leases, item detail processing state and retry/reprocess route.
- **Reusable:** `ImportJobService`, `keeper_ai_jobs`, `ai-job-retry-policy.ts`, worker route, `LiveProgressTracker`, `ImportReportView`, item detail status.
- **Missing backend:** Unified inbox projection across import and AI state; durable import-history schema (bulk reports are local); user review/dismiss/approve actions; explicit processing-event timeline and idempotent event semantics.
- **Missing UI:** A unified inbox list, actionable filters, review/approve flow, clear retry state, activity details.
- **Data/dependencies:** Persisted import jobs/items/events and review state; worker/database remain required.
- **Risks/order:** Avoid treating browser local job state as cross-device truth; distinguish transient AI stage vs terminal failure. Build after persistence boundary and status vocabulary are stabilized. **Sequence 1.**

### B. Intelligent Duplicate Detection — **Medium**

- **Existing:** Provider URL canonicalization, canonical URL unique constraint, platform source identity unique index, optional SHA-256 content fingerprint, client/service duplicate lookup and batch duplicate analysis.
- **Reusable:** `media-identity.ts`, normalizers/providers, SQL identity trigger/index, existing duplicate policy.
- **Missing backend:** Near-duplicate similarity candidates, versioned fingerprint rules, transactional duplicate review/merge and provenance conflict policy; current text fingerprint is equality-style, based on normalized title/description/caption/body and only for >=80 characters.
- **Missing UI:** Explainable “possible duplicate” review and merge/keep decisions.
- **Data/dependencies:** Fingerprint algorithm/version and optional similarity index; no new AI provider required initially.
- **Risks/order:** False merges can corrupt source identity and collection membership. Add after canonical identity tests and inbox review actions. **Sequence 2.**

### C. Advanced / Semantic Search — **High**

- **Existing:** In-memory lexical search, field weighting, synonyms/fuzzy match, assistant candidate retrieval and exact source citation checks.
- **Reusable:** `SearchService`, `AssistantAnswerService`, source representations, tags/topics and provenance.
- **Missing backend:** Embedding provider abstraction, embedding schema/vector extension, chunking, asynchronous indexing/update/delete, hybrid ranker, tenant-scoped vector retrieval and score evaluation.
- **Missing UI:** Semantic/hybrid controls, ranking/source explanations and filters at scale.
- **Data/dependencies:** Vector DB or pgvector decision, embeddings/chunks and index version. Adds provider cost and background load.
- **Risks/order:** RLS/tenant filters and stale/deleted chunk leakage; prompt/source grounding and latency. Implement after content preservation and stable server reads. **Sequence 3.**

### D. Content Preservation — **High**

- **Existing:** Source metadata, captions/body, transcript/OCR representations, provenance, media preview URLs and transcript history.
- **Reusable:** `ContentRepresentation`, media acquisition/preview, transcript history, ZIP archive reader.
- **Missing backend:** Durable owned media/source snapshots, checksums, capture version/content hash, retention/retake policy, storage abstraction and permissions; preview links alone do not preserve source media.
- **Missing UI:** Snapshot availability, freshness/source reachability, restoration and export controls.
- **Data/dependencies:** Object storage configuration, snapshot metadata/checksum/content manifests and lifecycle policy.
- **Risks/order:** Copyright/platform terms, unbounded storage cost, SSRF/malicious file ingestion, sensitive OCR/transcript retention. Start with text/source snapshot and metadata policy before media blobs. **Sequence 1 foundation.**

### E. Ask Keeper AI — **Medium to High**

- **Existing:** Grounded library assistant, scoped item selection, optional model call, quote validation, local fallback and conversation history.
- **Reusable:** `AssistantAnswerService`, `AIService`, `SearchService`, conversation APIs/history, provenance and collection scopes.
- **Missing backend:** Scalable retrieval (hybrid/semantic), chunk evidence IDs, citation offsets/URLs, prompt/model version record, conversation-to-source access revalidation, provider abstraction/budget controls and streaming if required.
- **Missing UI:** Citation navigation/preview, explicit retrieval scope and answer confidence/limits.
- **Data/dependencies:** Chunks/embeddings likely shared with C; durable AI request/citation telemetry.
- **Risks/order:** Never trust stored model history as authorization; re-check tenant and current visibility per turn; prevent prompt injection and fabricated claims. Build on C and D; current assistant is a useful prototype. **Sequence 4.**

### F. AI Content Re-discovery — **High**

- **Existing:** Saved timestamps, favorites, personal notes, archive/trash, related-item heuristic, collection assignment/correction memory.
- **Reusable:** SavedItem activity signals, assignment/correction tables, dashboard and collection UI.
- **Missing backend:** Item view/interaction events, recommendation eligibility and ranking, schedule/delivery mechanism, feedback/negative signal, notification preferences and recommendation history.
- **Missing UI:** “Rediscover” feed, explanation, feedback and cadence controls.
- **Data/dependencies:** Privacy-aware event schema and scheduled jobs; can begin deterministic rules before LLM.
- **Risks/order:** Sparse/noisy history, privacy expectations, repeated recommendations, cross-user leakage. Defer until event semantics and retention are agreed. **Sequence 6.**

### G. AI Learning Mode — **High**

- **Existing:** Grounded summaries, topics, key points, transcripts, assistant source excerpts.
- **Reusable:** ContentAnalysisService outputs/evidence, source representations, AI conversation UI.
- **Missing backend:** Learning objective/topic map, sequenced paths, flashcards/quizzes with answer evidence, learner progress/mastery, versioned generation and assessment feedback.
- **Missing UI:** Learning path, study session, quiz, progress and correction flow.
- **Data/dependencies:** Learning-path/session/card/attempt/progress schemas; grounded generation model.
- **Risks/order:** Incorrect instruction or quiz answer, unsupported cross-source synthesis, assessment data privacy. Build after D/C/E provide citations and stable retrieval. **Sequence 7.**

### H. Knowledge Graph — **High**

- **Existing:** Tags/topics, author/platform metadata, collection links, entity-like classification labels and item relatedness heuristic.
- **Reusable:** AI evidence snippets, tag categories, collection/item relations and `AIService.getRelatedItems`.
- **Missing backend:** Canonical entity registry, typed relation model, evidence/source offsets, confidence/temporal provenance, merge resolution, graph query/store and versioned extraction.
- **Missing UI:** Graph navigation/visualization, relation evidence and corrections.
- **Data/dependencies:** Relational graph tables or graph engine; entity resolution and extraction pipeline.
- **Risks/order:** Ontology drift, hallucinated edges, expensive graph growth and false identity merges. Wait until evidence/citation model and duplicate resolution are stable. **Sequence 8.**

## Verification meaning

Local tests validate many deterministic adapters, UI gates, merge rules and isolated service logic. They do not prove that configured AI providers, media access, database migrations, cloud RLS, worker scheduling, billing provider, or deployment works in the target environment.
