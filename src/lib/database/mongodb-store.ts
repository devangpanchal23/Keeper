import "server-only";
import { MongoClient, type Collection, type Db, type Document, type Filter as MongoFilter, type Sort } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertBackendConfiguration } from "./provider";
import { asDatabaseRows, errorResult, type BackendStore, type DatabaseRow, type Filter, type QueryBuilder, type QueryOperation, type QueryResult } from "./query";
import { persistWorkspaceAssignment } from "@/services/workspace-assignment-contract";
import { AI_JOB_LEASE_MILLISECONDS, AI_JOB_PROCESSING_STAGES, MAX_AI_JOB_ATTEMPTS } from "@/services/ai-job-retry-policy";
import { createContentFingerprint, createContentFingerprintCandidates, getContentFingerprintFields } from "@/services/content-fingerprint";
import { createOssImportLedgerEntry, getOssImportCycle, getOssImportEntitlement } from "@/services/usage-ledger-contract";

const COLLECTIONS = new Set([
  "billing_subscriptions", "billing_plan_catalog", "billing_payments", "razorpay_webhook_events", "billing_payment_failures",
  "keeper_media", "keeper_media_transcripts", "keeper_media_analyses", "keeper_collections", "keeper_ai_jobs",
  "keeper_workspace_memory", "keeper_organization_corrections", "keeper_workspace_assignments", "keeper_collection_profiles",
  "keeper_usage_ledger", "keeper_media_transcript_history", "keeper_ai_conversations", "keeper_ai_messages",
]);
let clientPromise: Promise<MongoClient> | undefined;
let indexPromise: Promise<void> | undefined;

async function getDatabase(): Promise<Db> {
  assertBackendConfiguration("mongodb");
  clientPromise ??= new MongoClient(process.env.MONGODB_URI!, {
    maxPoolSize: Number(process.env.DATABASE_POOL_MAX || 10),
    serverSelectionTimeoutMS: 10_000,
  }).connect().catch((error: unknown) => { clientPromise = undefined; throw error; });
  const client = await clientPromise;
  const dbName = process.env.MONGODB_DATABASE?.trim() || "keeper";
  const db = client.db(dbName);
  indexPromise ??= ensureIndexes(db).catch((error: unknown) => { indexPromise = undefined; throw error; });
  await indexPromise;
  return db;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("keeper_media").createIndex({ workspace_id: 1, canonical_url: 1 }, { unique: true, name: "workspace_canonical_url_unique" }),
    db.collection("keeper_media").createIndex({ workspace_id: 1, source_platform: 1, source_identifier: 1 }, { unique: true, partialFilterExpression: { source_identifier: { $type: "string" } }, name: "workspace_source_identifier_unique" }),
    db.collection("keeper_ai_jobs").createIndex({ workspace_id: 1, idempotency_key: 1 }, { unique: true, name: "workspace_idempotency_unique" }),
    db.collection("keeper_ai_jobs").createIndex({ status: 1, available_at: 1, locked_until: 1 }, { name: "job_claim_idx" }),
    db.collection("keeper_ai_jobs").createIndex({ media_id: 1 }, { unique: true, name: "job_media_unique" }),
    db.collection("keeper_collections").createIndex({ workspace_id: 1, id: 1 }, { unique: true, name: "workspace_collection_unique" }),
    db.collection("keeper_media_transcripts").createIndex({ media_id: 1 }, { unique: true, name: "transcript_media_unique" }),
    db.collection("keeper_media_analyses").createIndex({ media_id: 1 }, { unique: true, name: "analysis_media_unique" }),
    db.collection("keeper_ai_conversations").createIndex({ workspace_id: 1, updated_at: -1 }, { name: "conversation_list_idx" }),
    db.collection("keeper_ai_messages").createIndex({ workspace_id: 1, conversation_id: 1, created_at: 1 }, { name: "conversation_messages_idx" }),
    db.collection("billing_subscriptions").createIndex({ user_id: 1, status: 1, created_at: -1 }, { name: "billing_user_status_idx" }),
    db.collection("billing_payments").createIndex({ user_id: 1, created_at: -1 }, { name: "payments_user_created_idx" }),
    db.collection("razorpay_webhook_events").createIndex({ event_id: 1 }, { unique: true, sparse: true, name: "razorpay_event_unique" }),
    db.collection("keeper_usage_ledger").createIndex({ workspace_id: 1, cycle_start: 1, cycle_end: 1 }, { name: "usage_cycle_idx" }),
  ]);
}

function withMediaFingerprint(table: string, row: DatabaseRow): DatabaseRow {
  if (table !== "keeper_media" || !Object.prototype.hasOwnProperty.call(row, "payload")) return row;
  return { ...row, content_fingerprint: createContentFingerprint(getContentFingerprintFields(row.payload)) };
}

class MongoQuery implements QueryBuilder {
  private operation: QueryOperation = "select";
  private rows: DatabaseRow[] = [];
  private values: DatabaseRow = {};
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private maxRows?: number;
  private selected = "*";
  private wantCount = false;
  private headOnly = false;
  private conflictColumns: string[] = [];
  private executed?: Promise<QueryResult>;

  constructor(private readonly table: string) { if (!COLLECTIONS.has(table)) throw new Error(`Unknown Keeper collection: ${table}`); }
  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this { this.selected = columns; this.wantCount = options?.count === "exact"; this.headOnly = options?.head === true; return this; }
  eq(column: string, value: unknown): this { this.filters.push({ column, operator: "eq", value }); return this; }
  is(column: string, value: null | boolean): this { this.filters.push({ column, operator: "is", value }); return this; }
  in(column: string, value: unknown[]): this { this.filters.push({ column, operator: "in", value }); return this; }
  gte(column: string, value: unknown): this { this.filters.push({ column, operator: "gte", value }); return this; }
  lte(column: string, value: unknown): this { this.filters.push({ column, operator: "lte", value }); return this; }
  lt(column: string, value: unknown): this { this.filters.push({ column, operator: "lt", value }); return this; }
  order(column: string, options?: { ascending?: boolean }): this { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(count: number): this { if (!Number.isInteger(count) || count < 0) throw new Error("Query limit must be a non-negative integer."); this.maxRows = count; return this; }
  insert(values: DatabaseRow | DatabaseRow[]): this { this.operation = "insert"; this.rows = asDatabaseRows(values); return this; }
  upsert(values: DatabaseRow | DatabaseRow[], options?: { onConflict?: string }): this { this.operation = "upsert"; this.rows = asDatabaseRows(values); const defaults: Record<string, string[]> = { billing_plan_catalog: ["plan_key"], razorpay_webhook_events: ["event_id"], keeper_collections: ["workspace_id", "id"], keeper_media_transcripts: ["media_id"], keeper_media_analyses: ["media_id"], keeper_ai_jobs: ["workspace_id", "idempotency_key"], keeper_workspace_memory: ["workspace_id"], keeper_collection_profiles: ["workspace_id", "collection_id"], keeper_workspace_assignments: ["workspace_id", "media_id"] }; this.conflictColumns = (options?.onConflict || defaults[this.table]?.join(",") || "id").split(",").filter(Boolean); return this; }
  update(values: DatabaseRow): this { this.operation = "update"; this.values = values; return this; }
  delete(): this { this.operation = "delete"; return this; }
  then<TResult1 = QueryResult, TResult2 = never>(onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return this.run().then(onfulfilled, onrejected); }
  async maybeSingle(): Promise<{ data: DatabaseRow | null; error: QueryResult["error"] }> { const result = await this.run(); if (result.error) return { data: null, error: result.error }; if ((result.data?.length || 0) > 1) return { data: null, error: { code: "PGRST116", message: "Expected at most one document." } }; return { data: result.data?.[0] || null, error: null }; }
  async single(): Promise<{ data: DatabaseRow | null; error: QueryResult["error"] }> { const result = await this.run(); if (result.error) return { data: null, error: result.error }; if (result.data?.length !== 1) return { data: null, error: { code: "PGRST116", message: "Expected exactly one document." } }; return { data: result.data[0], error: null }; }
  private async run(): Promise<QueryResult> { this.executed ??= this.execute(); return this.executed; }
  private filter(): MongoFilter<Document> { const query: MongoFilter<Document> = {}; for (const entry of this.filters) { if (entry.operator === "eq" || entry.operator === "is") query[entry.column] = entry.value; else if (entry.operator === "in") query[entry.column] = { $in: Array.isArray(entry.value) ? entry.value : [] }; else query[entry.column] = { [entry.operator === "gte" ? "$gte" : entry.operator === "lt" ? "$lt" : "$lte"]: entry.value }; } return query; }
  private collection(db: Db): Collection<Document> { return db.collection(this.table); }
  private async execute(): Promise<QueryResult> {
    try {
      const db = await getDatabase();
      const collection = this.collection(db);
      const filter = this.filter();
      if (this.operation === "select") {
        const count = this.wantCount ? await collection.countDocuments(filter) : undefined;
        if (this.headOnly) return { data: null, error: null, count };
        const sort: Sort = Object.fromEntries(this.orders.map(({ column, ascending }) => [column, ascending ? 1 : -1]));
        const projection = this.selected === "*" ? undefined : Object.fromEntries(this.selected.split(",").map((column) => [column.trim(), 1]));
        const cursor = collection.find(filter, projection ? { projection } : undefined);
        if (Object.keys(sort).length) cursor.sort(sort);
        if (this.maxRows !== undefined) cursor.limit(this.maxRows);
        const data = (await cursor.toArray()).map(({ _id, ...row }) => ({ ...row, ...(row.id === undefined && _id ? { id: String(_id) } : {}) })) as DatabaseRow[];
        return { data, error: null, count: count ?? null };
      }
      if (this.operation === "insert") {
        const docs = this.rows.map((row) => ({ ...withMediaFingerprint(this.table, row), id: row.id ?? randomUUID() }));
        if (!docs.length) return { data: [], error: null };
        await collection.insertMany(docs);
        return { data: docs, error: null };
      }
      if (this.operation === "upsert") {
        const result: DatabaseRow[] = [];
        for (const row of this.rows) {
          const identity = Object.fromEntries(this.conflictColumns.map((column) => [column, row[column]]));
          const document: DatabaseRow = { ...withMediaFingerprint(this.table, row), id: row.id ?? randomUUID() };
          const { created_at: createdAt, ...mutable } = document;
          await collection.updateOne(identity, { $set: mutable, $setOnInsert: { created_at: createdAt ?? new Date().toISOString() } }, { upsert: true });
          const saved = await collection.findOne(identity);
          if (saved) { const { _id, ...plain } = saved; result.push({ ...plain, ...(plain.id === undefined && _id ? { id: String(_id) } : {}) } as DatabaseRow); }
        }
        return { data: result, error: null };
      }
      if (this.operation === "update") {
        await collection.updateMany(filter, { $set: withMediaFingerprint(this.table, this.values) });
        return { data: null, error: null };
      }
      await collection.deleteMany(filter);
      return { data: null, error: null };
    } catch (error) { return { data: null, error: errorResult(error) }; }
  }
}

export class MongoStore implements BackendStore {
  from(table: string): QueryBuilder { return new MongoQuery(table); }
  async rpc(name: string, args: DatabaseRow = {}): Promise<{ data: unknown; error: QueryResult["error"] }> {
    try {
      if (name === "keeper_import_media") return { data: await this.importMedia(args), error: null };
      if (name === "keeper_claim_ai_job") return { data: await this.claimJob(), error: null };
      if (name === "keeper_update_media_collection") return { data: await this.updateCollection(args), error: null };
      if (name === "keeper_update_media_tags") return { data: await this.updateTags(args), error: null };
      if (name === "keeper_reprocess_media") return { data: await this.reprocess(args), error: null };
      if (name === "keeper_get_or_create_ai_collection") return { data: await this.getOrCreateCollection(args), error: null };
      if (name === "keeper_record_ai_assignment") return { data: await this.recordAssignment(args), error: null };
      return { data: null, error: { code: "42883", message: `Keeper database operation ${name} is not implemented for MongoDB mode.` } };
    } catch (error) { return { data: null, error: errorResult(error) }; }
  }
  private async importMedia(args: DatabaseRow): Promise<DatabaseRow> {
    const db = await getDatabase();
    const client = await clientPromise!;
    const workspaceId = args.p_workspace_id;
    if (typeof workspaceId !== "string") throw new Error("Import requires an authenticated workspace.");
    const canonicalUrl = String(args.p_canonical_url || "");
    const payload = args.p_payload;
    if (!canonicalUrl || typeof payload !== "object" || payload === null) throw new Error("Import request is incomplete.");
    const session = client.startSession();
    try {
      let response: DatabaseRow = {};
      await session.withTransaction(async () => {
        const media = db.collection("keeper_media");
        const jobs = db.collection("keeper_ai_jobs");
        const ledger = db.collection("keeper_usage_ledger");
        const payloadRecord = payload as DatabaseRow;
        const metadata = payloadRecord.metadata as DatabaseRow || {};
        const sourcePlatform = String(payloadRecord.platform || metadata.sourcePlatform || "");
        const sourceIdentifier = String(metadata.sourceIdentifier || metadata.shortcode || metadata.fbid || ((metadata.rawPlatformMetadata as DatabaseRow | undefined)?.id) || "");
        const fingerprintFields = getContentFingerprintFields(payloadRecord);
        const fingerprint = createContentFingerprint(fingerprintFields);
        const fingerprintCandidates = createContentFingerprintCandidates(fingerprintFields);
        const duplicateQuery: MongoFilter<Document> = { workspace_id: workspaceId, $or: [{ canonical_url: canonicalUrl }, ...(sourcePlatform && sourceIdentifier ? [{ source_platform: sourcePlatform, source_identifier: sourceIdentifier }] : []), ...fingerprintCandidates.map((candidate) => ({ content_fingerprint: candidate }))] };
        const existing = await media.findOne(duplicateQuery, { session });
        if (existing) { response = { media_id: String(existing.id || existing._id), duplicate: true, status: existing.processing_status }; return; }
        const now = new Date();
        const memoryResult = await db.collection("keeper_workspace_memory").findOneAndUpdate({ workspace_id: workspaceId }, { $setOnInsert: { free_cycle_anchor: now.toISOString(), media_count: 0 }, $inc: { import_lock_version: 1 } }, { upsert: true, returnDocument: "after", session });
        const anchor = new Date(String(memoryResult?.free_cycle_anchor || now.toISOString()));
        const cycle = getOssImportCycle(now, anchor);
        const cycleStart = cycle.cycleStart;
        const cycleEnd = cycle.cycleEnd;
        const used = await ledger.countDocuments({ workspace_id: workspaceId, cycle_start: cycleStart.toISOString(), cycle_end: cycleEnd.toISOString() }, { session });
        const mediaId = randomUUID();
        const jobId = randomUUID();
        const idempotencyKey = String(args.p_idempotency_key || randomUUID());
        await media.insertOne({ id: mediaId, workspace_id: workspaceId, canonical_url: canonicalUrl, source_platform: sourcePlatform || null, source_identifier: sourceIdentifier || null, content_fingerprint: fingerprint, payload, processing_status: "QUEUED", created_at: now.toISOString(), updated_at: now.toISOString() }, { session });
        const ledgerEntry = createOssImportLedgerEntry("created", cycle)!;
        const entitlement = getOssImportEntitlement();
        await ledger.insertOne({ id: randomUUID(), workspace_id: workspaceId, media_id: mediaId, ...ledgerEntry, created_at: now.toISOString() }, { session });
        await jobs.insertOne({ id: jobId, workspace_id: workspaceId, media_id: mediaId, status: "QUEUED", attempts: 0, available_at: now.toISOString(), locked_until: null, idempotency_key: idempotencyKey, created_at: now.toISOString(), updated_at: now.toISOString() }, { session });
        response = { media_id: mediaId, job_id: jobId, status: "QUEUED", duplicate: false, plan: entitlement.plan, used: used + 1, remaining: entitlement.limit, unlimited: entitlement.unlimited, cycle_end: cycleEnd.toISOString() };
      });
      return response;
    } finally { await session.endSession(); }
  }
  private async claimJob(): Promise<DatabaseRow[]> {
    const db = await getDatabase();
    const client = await clientPromise!;
    const session = client.startSession();
    const claimResult: { job: Document | null } = { job: null };
    try {
      await session.withTransaction(async () => {
        const jobs = db.collection("keeper_ai_jobs");
        const now = new Date();
        const dueOrExpiredLease = { $or: [{ locked_until: null }, { locked_until: { $lte: now.toISOString() } }] };
        const exhaustedFilter: MongoFilter<Document> = {
          status: { $in: [...AI_JOB_PROCESSING_STAGES] },
          attempts: { $gte: MAX_AI_JOB_ATTEMPTS },
          ...dueOrExpiredLease,
        };
        const exhausted = await jobs.find(exhaustedFilter, {
          session,
          projection: { _id: 0, workspace_id: 1, media_id: 1 },
        }).toArray();
        if (exhausted.length > 0) {
          await jobs.updateMany(exhaustedFilter, [{ $set: {
            status: "FAILED",
            locked_until: null,
            last_error: { $ifNull: ["$last_error", "Worker lease expired after the retry limit."] },
            failure_code: { $ifNull: ["$failure_code", "RETRY_EXHAUSTED"] },
            updated_at: now.toISOString(),
          } }], { session });
          const mediaOwners = exhausted
            .filter((job) => typeof job.workspace_id === "string" && typeof job.media_id === "string")
            .map((job) => ({ id: job.media_id, workspace_id: job.workspace_id }));
          if (mediaOwners.length > 0) {
            await db.collection("keeper_media").updateMany(
              { $or: mediaOwners },
              { $set: { processing_status: "FAILED", updated_at: now.toISOString() } },
              { session },
            );
          }
        }

        claimResult.job = await jobs.findOneAndUpdate(
          {
            status: { $in: [...AI_JOB_PROCESSING_STAGES] },
            attempts: { $lt: MAX_AI_JOB_ATTEMPTS },
            available_at: { $lte: now.toISOString() },
            ...dueOrExpiredLease,
          },
          { $set: { status: "EXTRACTING", locked_until: new Date(now.getTime() + AI_JOB_LEASE_MILLISECONDS).toISOString(), updated_at: now.toISOString() }, $inc: { attempts: 1 } },
          { session, sort: { available_at: 1, created_at: 1, id: 1, _id: 1 }, returnDocument: "after" },
        );
      });
    } finally { await session.endSession(); }
    const result = claimResult.job;
    if (!result) return [];
    const { _id, ...job } = result;
    return [{ ...job, ...(job.id === undefined && _id ? { id: String(_id) } : {}) } as DatabaseRow];
  }
  private async updateCollection(args: DatabaseRow): Promise<null> {
    const db = await getDatabase(); const workspace = String(args.p_workspace_id || ""); const id = String(args.p_media_id || ""); const collectionId = typeof args.p_collection_id === "string" ? args.p_collection_id : null;
    const media = db.collection("keeper_media"); const row = await media.findOne({ id, workspace_id: workspace });
    if (!row) throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
    if (collectionId && !await db.collection("keeper_collections").findOne({ workspace_id: workspace, id: collectionId })) throw Object.assign(new Error("COLLECTION_NOT_FOUND"), { code: "P0002" });
    const payload = row.payload as DatabaseRow; const metadata = payload.metadata as DatabaseRow || {}; const collections = collectionId ? [collectionId] : [];
    const next = { ...payload, collectionId, collections, metadata: { ...metadata, aiOrganization: { ...(metadata.aiOrganization as DatabaseRow || {}), aiAssignedCollectionIds: [], manualCollectionIds: collections, autoOrganizationDisabled: !collectionId } } };
    await media.updateOne({ id, workspace_id: workspace }, { $set: { payload: next, content_fingerprint: createContentFingerprint(getContentFingerprintFields(next)), updated_at: new Date().toISOString() } });
    await db.collection("keeper_media_analyses").updateOne({ media_id: id, workspace_id: workspace }, { $set: { collection_id: collectionId, updated_at: new Date().toISOString() } });
    await db.collection("keeper_organization_corrections").insertOne({ id: randomUUID(), workspace_id: workspace, media_id: id, from_collection_id: payload.collectionId ?? null, to_collection_id: collectionId, media_tags: payload.tags || [], media_topic: Array.isArray(payload.topics) ? payload.topics[0] || null : null, created_at: new Date().toISOString() });
    return null;
  }
  private async updateTags(args: DatabaseRow): Promise<null> {
    const db = await getDatabase(); const workspace = String(args.p_workspace_id || ""); const id = String(args.p_media_id || "");
    const tags = Array.isArray(args.p_tags) ? args.p_tags : []; const userTags = Array.isArray(args.p_user_tags) ? args.p_user_tags : []; const suppressed = Array.isArray(args.p_suppressed_ai_tags) ? args.p_suppressed_ai_tags : [];
    if (tags.length > 24 || userTags.length > 24 || suppressed.length > 24) throw Object.assign(new Error("TAG_LIMIT_EXCEEDED"), { code: "22023" });
    const row = await db.collection("keeper_media").findOne({ id, workspace_id: workspace });
    if (!row) throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
    const payload = row.payload as DatabaseRow; const metadata = payload.metadata as DatabaseRow || {};
    const next = { ...payload, tags, metadata: { ...metadata, userTags, suppressedAiTags: suppressed } };
    await db.collection("keeper_media").updateOne({ id, workspace_id: workspace }, { $set: { payload: next, content_fingerprint: createContentFingerprint(getContentFingerprintFields(next)), updated_at: new Date().toISOString() } }); return null;
  }
  private async reprocess(args: DatabaseRow): Promise<DatabaseRow> {
    const db = await getDatabase(); const workspace = String(args.p_workspace_id || ""); const id = String(args.p_media_id || ""); const payload = args.p_payload;
    if (typeof payload !== "object" || !payload) throw new Error("Reprocess payload is required.");
    const media = db.collection("keeper_media"); const row = await media.findOne({ id, workspace_id: workspace });
    if (!row) throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
    if ((payload as DatabaseRow).url !== row.canonical_url) throw Object.assign(new Error("CANONICAL_URL_IMMUTABLE"), { code: "22023" });
    const now = new Date().toISOString();
    await media.updateOne({ id, workspace_id: workspace }, { $set: { payload, content_fingerprint: createContentFingerprint(getContentFingerprintFields(payload)), processing_status: "QUEUED", updated_at: now } });
    const transcript = await db.collection("keeper_media_transcripts").findOne({ media_id: id, workspace_id: workspace });
    if (transcript) { const { _id, ...previous } = transcript; await db.collection("keeper_media_transcript_history").insertOne({ ...previous, id: randomUUID(), transcript_updated_at: transcript.updated_at, created_at: now }); await db.collection("keeper_media_transcripts").deleteOne({ media_id: id, workspace_id: workspace }); }
    const jobId = randomUUID(); const key = `reprocess:${id}:${jobId}`;
    await db.collection("keeper_ai_jobs").updateOne({ media_id: id, workspace_id: workspace }, { $set: { status: "QUEUED", attempts: 0, available_at: now, locked_until: null, last_error: null, failure_code: null, idempotency_key: key, updated_at: now }, $setOnInsert: { id: jobId, workspace_id: workspace, media_id: id, created_at: now } }, { upsert: true });
    return { media_id: id, status: "QUEUED" };
  }
  private async getOrCreateCollection(args: DatabaseRow): Promise<DatabaseRow> {
    const db = await getDatabase(); const workspace = String(args.p_workspace_id || ""); const name = String(args.p_name || "").trim();
    if (name.length < 4 || name.length > 120 || !workspace) throw Object.assign(new Error("INVALID_AI_COLLECTION"), { code: "22023" });
    const collections = db.collection("keeper_collections"); const existing = await collections.findOne({ workspace_id: workspace, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
    if (existing) return { id: existing.id, name: existing.name, description: existing.description, created: false };
    const id = randomUUID(); const terms = Array.isArray(args.p_terms) ? args.p_terms : []; const description = String(args.p_description || "").slice(0, 1000); const now = new Date().toISOString();
    await collections.insertOne({ workspace_id: workspace, id, name, description, profile: { topics: terms, tags: terms, createdBy: "keeper_ai" }, updated_at: now });
    await db.collection("keeper_collection_profiles").updateOne({ workspace_id: workspace, collection_id: id }, { $set: { terms, updated_at: now }, $setOnInsert: { examples: 0 } }, { upsert: true });
    return { id, name, description, created: true };
  }
  private async recordAssignment(args: DatabaseRow): Promise<null> {
    if (typeof args.p_workspace_id !== "string" || typeof args.p_media_id !== "string") throw Object.assign(new Error("INVALID_ASSIGNMENT"), { code: "22023" });
    const workspace = args.p_workspace_id;
    const mediaId = args.p_media_id;
    if (args.p_collection_id != null && typeof args.p_collection_id !== "string") throw Object.assign(new Error("INVALID_ASSIGNMENT"), { code: "22023" });
    const collectionId = args.p_collection_id == null ? null : args.p_collection_id;
    if (!workspace || !mediaId || collectionId === "") throw Object.assign(new Error("INVALID_ASSIGNMENT"), { code: "22023" });
    const db = await getDatabase();
    const client = await clientPromise!;
    const session = client.startSession();
    try {
      await persistWorkspaceAssignment({ workspaceId: workspace, mediaId, collectionId }, {
        transaction: (operation) => session.withTransaction(operation),
        findMediaWorkspaceId: async (id) => {
          const media = await db.collection("keeper_media").findOne({ id }, { session, projection: { workspace_id: 1 } });
          return typeof media?.workspace_id === "string" ? media.workspace_id : null;
        },
        findCollectionWorkspaceId: async (workspaceId, id) => {
          const collection = await db.collection("keeper_collections").findOne({ workspace_id: workspaceId, id }, { session, projection: { workspace_id: 1 } });
          return typeof collection?.workspace_id === "string" ? collection.workspace_id : null;
        },
        writeAssignment: async () => {
          const now = new Date().toISOString();
          await db.collection("keeper_workspace_assignments").updateOne(
            { workspace_id: workspace, media_id: mediaId },
            { $set: { collection_id: collectionId, topic: args.p_topic ?? null, tags: Array.isArray(args.p_tags) ? args.p_tags : [], assigned_at: now }, $setOnInsert: { workspace_id: workspace, media_id: mediaId } },
            { upsert: true, session },
          );
        },
      });
      return null;
    } finally { await session.endSession(); }
  }
}

export async function closeMongoClient(): Promise<void> { if (clientPromise) await (await clientPromise).close(); clientPromise = undefined; indexPromise = undefined; }
