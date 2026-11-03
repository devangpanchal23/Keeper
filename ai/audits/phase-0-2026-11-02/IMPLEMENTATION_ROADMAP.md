# Keeper Phase 0 — Advanced AI V1 Roadmap

This sequence is based on current source/schema boundaries, not a commitment to an implementation scope. Estimated complexity reflects engineering breadth and integration risk.

## Readiness decisions

1. **Resolve persistence scope first.** Define the authoritative server representation for all saved items, including local/demo writes, user edits and deletes. Establish parity across Supabase, standalone PostgreSQL, and MongoDB—or explicitly narrow supported modes for V1.
2. **Harden platform-independent foundations.** Make session signing require a deployment secret, and obtain a passing isolated database integration baseline before adding data retrieval products.
3. **Preserve evidence before adding AI behaviors.** Store normalized source snapshots, provenance, checksums and retention rules. Keep restricted/partial source states visible.
4. **Build a durable user-facing inbox.** Unify imports and asynchronous AI jobs into a persisted queue/history/review surface; this gives duplicate review and failures a usable home.
5. **Add hybrid search and shared evidence chunks.** Lexical search already works locally. Introduce versioned chunks/embeddings and tenant-filtered retrieval only after durable data boundaries are stable.
6. **Reuse retrieval for Ask Keeper, learning and graph.** Add source citations and evidence IDs before generating learning material or graph edges.

## Ordered delivery plan

| Order | Work | Main prerequisites | Complexity | Acceptance focus |
|---:|---|---|---|---|
| 0 | Security and persistence baseline: session secret policy; DB integration harness isolated from developer `.env.local`; schema parity decision; authoritative library sync contract | None | Medium | Missing secret fails closed; all DB modes pass tenant-isolation and migration checks; local-only data boundaries documented. |
| 1 | **D — Content Preservation foundation**: snapshot/text persistence, provenance/checksum, retention and storage interfaces | 0 | High | Source text and metadata survive source outage; checksum/version is stable; retention/export/delete semantics tested. |
| 2 | **A — Smart Inbox**: persisted import + AI job status aggregation, retries, review and history | 0, partial D | Medium | Status survives reload/device, user can filter/retry/review, no duplicate job on retry, failures remain attached to saved item. |
| 3 | **B — Intelligent Duplicate Detection**: versioned fingerprints, candidate similarity, review/merge operations | 0, 1, 2 | Medium | No automatic destructive merge; distinct media IDs remain distinct; tenant scope and collection/source metadata preserved. |
| 4 | **C — Advanced/Semantic Search**: chunking, embedding provider, index lifecycle, hybrid ranking | 0, 1 | High | Search respects user/collection/archive/trash scope, removes stale index entries, citations map to stored source spans. |
| 5 | **E — Ask Keeper AI**: cited retrieval, request budgets, source navigation, conversation scope | 4 | Medium–High | Every answer claim maps to exact saved evidence; access is checked at retrieval time; no unsupported provider output rendered as fact. |
| 6 | **F — AI Content Re-discovery**: user-approved activity signals, deterministic recommender baseline, feedback and schedule | 0, 2 | High | Explainable recommendation, dedupe/cooldown, opt-out and data retention behavior, no cross-user signals. |
| 7 | **G — AI Learning Mode**: source-grounded paths, flashcards/quizzes, evidence and learner progress | 1, 4, 5 | High | Each generated card/answer has verifiable source evidence; edits/feedback and progress persist within workspace. |
| 8 | **H — Knowledge Graph**: entity resolution, relation schema, evidence tracking and visualization | 1, 3, 4, 5 | High | Every edge has item/source evidence and confidence; entity merge can be corrected; graph query remains tenant-scoped. |

## Feature-by-feature scope notes

### A. Smart Inbox

Reuse `keeper_ai_jobs`, worker leases/retry policy, bulk report UI and item processing state. Add durable import-job/item history and a query/projection joining import completion with downstream AI processing. Do not equate the existing localStorage bulk job with a durable server queue.

### B. Intelligent Duplicate Detection

Keep canonical URL and provider source identity as exact-match keys. Evolve `content_fingerprint` with algorithm version and use it only for candidate generation. Similarity should be reviewable and explainable; never merge without confirming source ownership and preserving collection membership/provenance.

### C. Advanced / Semantic Search

Start from the current lexical `SearchService`; add embeddings as a retriever, not a replacement. Choose pgvector vs external vector service based on supported self-hosting modes. Define chunk source span, embedding model/version, status, workspace ID, and deletion/update lifecycle. Benchmark on a labeled evaluation corpus before ranking changes.

### D. Content Preservation

Define “preserved” separately for metadata, extracted text, and binary media. Store content snapshot time/source/provenance/checksum and a retention policy. Object storage should be pluggable and optional for self-hosters; media acquisition must retain SSRF and source authorization controls.

### E. Ask Keeper AI

The existing assistant is an evidence-selection prototype; it validates exact quotes but supplies at most eight candidates from in-memory items. Connect hybrid retrieval to citations with immutable source IDs and text offsets, reauthorize on every request, and persist model/provider/prompt version and citation metadata.

### F. AI Content Re-discovery

Current favorites, saved dates, related-item heuristic and assignment corrections are not a sufficiently complete behavior history. Begin with deterministic resurfacing and explicit feedback. Avoid treating collection correction history as broad user preference without consent/context.

### G. AI Learning Mode

Reuse grounded summaries, topics, key points and transcript/OCR evidence. Add separate learning records; do not overload SavedItem payload with quiz attempts/progress. Require answer evidence and a correction path.

### H. Knowledge Graph

Reuse evidence-bearing tags and topics only as candidate entities. Introduce canonical entity IDs and explicit relation types; keep evidence item/span, extractor/model version, timestamp and human correction. Select relational edge tables first unless graph query requirements justify a graph database.

## Cross-cutting release gates

- Maintain the source-of-truth and provenance invariants listed in `REGRESSION_BASELINE.md`.
- Unit-test algorithms and parsers, then run isolated database integration coverage in each supported store. Do not use production credentials in tests.
- Add migration rollback/forward review and RLS/ownership validation for every new table and index.
- Measure worker concurrency, model/provider latency and per-user cost before enabling broad background processing.
- Document optional service setup and failure behavior for self-hosters.
