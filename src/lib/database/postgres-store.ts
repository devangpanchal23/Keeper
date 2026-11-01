import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { assertBackendConfiguration } from "./provider";
import { asDatabaseRows, errorResult, type BackendStore, type DatabaseRow, type Filter, type QueryBuilder, type QueryOperation, type QueryResult } from "./query";

const TABLES = new Set([
  "billing_subscriptions", "billing_plan_catalog", "billing_payments", "razorpay_webhook_events", "billing_payment_failures",
  "keeper_media", "keeper_media_transcripts", "keeper_media_analyses", "keeper_collections", "keeper_ai_jobs",
  "keeper_workspace_memory", "keeper_organization_corrections", "keeper_workspace_assignments", "keeper_collection_profiles",
  "keeper_usage_ledger", "keeper_media_transcript_history", "keeper_ai_conversations", "keeper_ai_messages",
]);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX || 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });

function quoteIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Unsupported SQL identifier.");
  return `"${value}"`;
}

class PostgresQuery implements QueryBuilder {
  private operation: QueryOperation = "select";
  private rows: DatabaseRow[] = [];
  private values: DatabaseRow = {};
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private maxRows: number | undefined;
  private selected = "*";
  private wantCount = false;
  private headOnly = false;
  private conflictColumns: string[] = [];
  private executed?: Promise<QueryResult>;

  constructor(private readonly table: string) {
    if (!TABLES.has(table)) throw new Error(`Unknown Keeper table: ${table}`);
  }
  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this { this.operation = this.operation === "select" ? "select" : this.operation; this.selected = columns === "*" ? "*" : columns.split(",").map((column) => quoteIdentifier(column.trim())).join(","); this.wantCount = options?.count === "exact"; this.headOnly = options?.head === true; return this; }
  eq(column: string, value: unknown): this { this.filters.push({ column, operator: "eq", value }); return this; }
  is(column: string, value: null | boolean): this { this.filters.push({ column, operator: "is", value }); return this; }
  in(column: string, value: unknown[]): this { this.filters.push({ column, operator: "in", value }); return this; }
  gte(column: string, value: unknown): this { this.filters.push({ column, operator: "gte", value }); return this; }
  lte(column: string, value: unknown): this { this.filters.push({ column, operator: "lte", value }); return this; }
  lt(column: string, value: unknown): this { this.filters.push({ column, operator: "lt", value }); return this; }
  order(column: string, options?: { ascending?: boolean }): this { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(count: number): this { if (!Number.isInteger(count) || count < 0) throw new Error("Query limit must be a non-negative integer."); this.maxRows = count; return this; }
  insert(values: DatabaseRow | DatabaseRow[]): this { this.operation = "insert"; this.rows = asDatabaseRows(values); return this; }
  upsert(values: DatabaseRow | DatabaseRow[], options?: { onConflict?: string }): this { this.operation = "upsert"; this.rows = asDatabaseRows(values); this.conflictColumns = (options?.onConflict || "").split(",").filter(Boolean); return this; }
  update(values: DatabaseRow): this { this.operation = "update"; this.values = values; return this; }
  delete(): this { this.operation = "delete"; return this; }
  then<TResult1 = QueryResult, TResult2 = never>(onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return this.run().then(onfulfilled, onrejected); }
  async maybeSingle(): Promise<{ data: DatabaseRow | null; error: QueryResult["error"] }> { const result = await this.run(); if (result.error) return { data: null, error: result.error }; if ((result.data?.length || 0) > 1) return { data: null, error: { code: "PGRST116", message: "Expected at most one row." } }; return { data: result.data?.[0] || null, error: null }; }
  async single(): Promise<{ data: DatabaseRow | null; error: QueryResult["error"] }> { const result = await this.run(); if (result.error) return { data: null, error: result.error }; if (result.data?.length !== 1) return { data: null, error: { code: "PGRST116", message: "Expected exactly one row." } }; return { data: result.data[0], error: null }; }
  private async run(): Promise<QueryResult> { if (!this.executed) this.executed = this.execute(); return this.executed; }
  private where(values: unknown[]): string { return this.filters.map((filter) => { const column = quoteIdentifier(filter.column); if (filter.operator === "is") return `${column} IS ${filter.value === null ? "NULL" : filter.value ? "TRUE" : "FALSE"}`; if (filter.operator === "in") { const list = Array.isArray(filter.value) ? filter.value : []; if (!list.length) return "FALSE"; const marks = list.map((entry) => { values.push(entry); return `$${values.length}`; }); return `${column} IN (${marks.join(",")})`; } if (filter.operator === "eq" && filter.value === null) return `${column} IS NULL`; values.push(filter.value); const operator = filter.operator === "eq" ? "=" : filter.operator === "gte" ? ">=" : filter.operator === "lt" ? "<" : "<="; return `${column} ${operator} $${values.length}`; }).join(" AND "); }
  private async execute(): Promise<QueryResult> {
    assertBackendConfiguration("postgres");
    const client = await pool.connect();
    try { return await this.executeWith(client); } catch (error) { return { data: null, error: errorResult(error) }; } finally { client.release(); }
  }
  private async executeWith(client: PoolClient): Promise<QueryResult> {
    const values: unknown[] = [];
    const table = `public.${quoteIdentifier(this.table)}`;
    if (this.operation === "select") {
      const where = this.where(values);
      const whereSql = where ? ` WHERE ${where}` : "";
      const countResult = this.wantCount ? await client.query(`SELECT count(*)::int AS count FROM ${table}${whereSql}`, values) : undefined;
      if (this.headOnly) return { data: null, error: null, count: Number(countResult?.rows[0]?.count ?? 0) };
      const order = this.orders.length ? ` ORDER BY ${this.orders.map((entry) => `${quoteIdentifier(entry.column)} ${entry.ascending ? "ASC" : "DESC"}`).join(",")}` : "";
      const limit = this.maxRows === undefined ? "" : ` LIMIT ${this.maxRows}`;
      const result = await client.query(`SELECT ${this.selected} FROM ${table}${whereSql}${order}${limit}`, values);
      return { data: result.rows as DatabaseRow[], error: null, count: countResult ? Number(countResult.rows[0]?.count ?? 0) : null };
    }
    if (this.operation === "insert" || this.operation === "upsert") {
      if (!this.rows.length) return { data: [], error: null };
      const columns = [...new Set(this.rows.flatMap((row) => Object.keys(row)))];
      if (!columns.length) throw new Error("Cannot insert an empty row.");
      const tuples = this.rows.map((row) => `(${columns.map((column) => { values.push(row[column] ?? null); return `$${values.length}`; }).join(",")})`);
      let conflict = "";
      if (this.operation === "upsert") {
        const defaults: Record<string, string[]> = { keeper_collections: ["workspace_id", "id"], keeper_media_transcripts: ["media_id"], keeper_media_analyses: ["media_id"], keeper_ai_jobs: ["workspace_id", "idempotency_key"], keeper_workspace_memory: ["workspace_id"], keeper_collection_profiles: ["workspace_id", "collection_id"] };
        const keys = this.conflictColumns.length ? this.conflictColumns : (defaults[this.table] || ["id"]);
        conflict = ` ON CONFLICT (${keys.map(quoteIdentifier).join(",")}) DO UPDATE SET ${columns.filter((column) => !keys.includes(column)).map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`).join(",") || `${quoteIdentifier(keys[0])} = EXCLUDED.${quoteIdentifier(keys[0])}`}`;
      }
      const result = await client.query(`INSERT INTO ${table} (${columns.map(quoteIdentifier).join(",")}) VALUES ${tuples.join(",")}${conflict} RETURNING *`, values);
      return { data: result.rows as DatabaseRow[], error: null };
    }
    const columns = Object.keys(this.values);
    if (this.operation === "update") {
      if (!columns.length) return { data: [], error: null };
      const assignments = columns.map((column) => { values.push(this.values[column] ?? null); return `${quoteIdentifier(column)} = $${values.length}`; });
      const where = this.where(values);
      const whereSql = where ? ` WHERE ${where}` : "";
      const result = await client.query(`UPDATE ${table} SET ${assignments.join(",")}${whereSql} RETURNING *`, values);
      return { data: result.rows as DatabaseRow[], error: null };
    }
    const where = this.where(values);
    const whereSql = where ? ` WHERE ${where}` : "";
    const result = await client.query(`DELETE FROM ${table}${whereSql} RETURNING *`, values);
    return { data: result.rows as DatabaseRow[], error: null };
  }
}

export class PostgresStore implements BackendStore {
  from(table: string): QueryBuilder { return new PostgresQuery(table); }
  async rpc(name: string, args: DatabaseRow = {}): Promise<{ data: unknown; error: QueryResult["error"] }> {
    const client = await pool.connect();
    try {
      if (name === "keeper_import_media") return { data: await this.importMedia(client, args), error: null };
      if (name === "keeper_claim_ai_job") return { data: await this.claimJob(client), error: null };
      if (name === "keeper_update_media_collection") return { data: await this.updateCollection(client, args), error: null };
      if (name === "keeper_update_media_tags") return { data: await this.updateTags(client, args), error: null };
      if (name === "keeper_reprocess_media") return { data: await this.reprocess(client, args), error: null };
      if (name === "keeper_get_or_create_ai_collection") return { data: await this.getOrCreateCollection(client, args), error: null };
      if (name === "keeper_record_ai_assignment") return { data: await this.recordAssignment(client, args), error: null };
      return { data: null, error: { code: "42883", message: `Keeper database operation ${name} is not implemented for PostgreSQL mode.` } };
    } catch (error) { return { data: null, error: errorResult(error) }; } finally { client.release(); }
  }
  private async importMedia(client: PoolClient, args: DatabaseRow): Promise<DatabaseRow> {
    const workspaceId = String(args.p_workspace_id || "");
    const canonicalUrl = String(args.p_canonical_url || "");
    const payload = args.p_payload;
    if (!workspaceId || !canonicalUrl || typeof payload !== "object" || !payload) throw new Error("Import requires an authenticated workspace, URL, and payload.");
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [workspaceId]);
      const payloadRecord = payload as DatabaseRow;
      const metadata = payloadRecord.metadata as DatabaseRow || {};
      const sourcePlatform = String(payloadRecord.platform || metadata.sourcePlatform || "");
      const rawMetadata = metadata.rawPlatformMetadata as DatabaseRow | undefined;
      const sourceIdentifier = String(metadata.sourceIdentifier || metadata.shortcode || metadata.fbid || rawMetadata?.id || "");
      const fingerprintText = [payloadRecord.title, payloadRecord.description, metadata.caption, metadata.bodyText].filter((part): part is string => typeof part === "string").join(" ").trim().toLowerCase();
      const fingerprint = fingerprintText.length >= 80 ? createHash("sha256").update(fingerprintText).digest("hex") : null;
      const duplicate = await client.query("SELECT id, processing_status FROM public.keeper_media WHERE workspace_id=$1 AND (canonical_url=$2 OR ($3::text IS NOT NULL AND source_platform=$4 AND source_identifier=$3) OR ($5::text IS NOT NULL AND content_fingerprint=$5)) FOR UPDATE", [workspaceId, canonicalUrl, sourceIdentifier || null, sourcePlatform || null, fingerprint]);
      if (duplicate.rows[0]) { await client.query("COMMIT"); return { duplicate: true, media_id: duplicate.rows[0].id, status: duplicate.rows[0].processing_status }; }
      const subResult = await client.query("SELECT * FROM public.billing_subscriptions WHERE user_id=$1 AND (status IN ('trialing','authenticated','active') OR (status IN ('cancelled','canceled') AND (cancel_at_cycle_end OR trial_ends_at IS NOT NULL))) AND coalesce(current_period_end,trial_ends_at,'infinity'::timestamptz)>now() ORDER BY coalesce(current_period_end,trial_ends_at) DESC LIMIT 1", [workspaceId]);
      const sub = subResult.rows[0] as DatabaseRow | undefined;
      const plan = String(sub?.plan || "free");
      let cycleStart: Date;
      let cycleEnd: Date;
      let limit = 30;
      if (sub) {
        cycleStart = new Date(String(sub.current_period_start || sub.created_at));
        cycleEnd = new Date(String(sub.current_period_end || sub.trial_ends_at || new Date(cycleStart.getTime() + 7 * 86400000).toISOString()));
        limit = plan === "basic" ? (sub.billing_cycle === "yearly" ? 3600 : 300) : plan === "pro" ? (sub.billing_cycle === "yearly" ? 6000 : 500) : 30;
      } else {
        await client.query("INSERT INTO public.keeper_workspace_memory(workspace_id) VALUES($1) ON CONFLICT DO NOTHING", [workspaceId]);
        const memory = await client.query("SELECT free_cycle_anchor FROM public.keeper_workspace_memory WHERE workspace_id=$1 FOR UPDATE", [workspaceId]);
        const anchor = new Date(String(memory.rows[0].free_cycle_anchor));
        cycleStart = new Date(anchor.getTime() + Math.floor((Date.now() - anchor.getTime()) / 604800000) * 604800000);
        cycleEnd = new Date(cycleStart.getTime() + 604800000);
      }
      const usage = await client.query("SELECT count(*)::int AS used FROM public.keeper_usage_ledger WHERE workspace_id=$1 AND cycle_start=$2 AND cycle_end=$3", [workspaceId, cycleStart, cycleEnd]);
      const used = Number(usage.rows[0]?.used || 0);
      if (limit >= 0 && used >= limit) throw new Error("CREDIT_LIMIT_REACHED");
      const inserted = await client.query("INSERT INTO public.keeper_media(workspace_id,canonical_url,payload,processing_status,source_platform,source_identifier,content_fingerprint) VALUES($1,$2,$3,'QUEUED',$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id", [workspaceId, canonicalUrl, payload, sourcePlatform || null, sourceIdentifier || null, fingerprint]);
      if (!inserted.rows[0]) throw new Error("IMPORT_CONFLICT");
      const mediaId = inserted.rows[0].id as string;
      await client.query("INSERT INTO public.keeper_usage_ledger(workspace_id,media_id,event_type,plan,cycle_start,cycle_end) VALUES($1,$2,$3,$4,$5,$6)", [workspaceId, mediaId, plan === "free" ? "FREE_IMPORT" : "IMPORT_CREDIT", plan, cycleStart, cycleEnd]);
      await client.query("INSERT INTO public.keeper_ai_jobs(workspace_id,media_id,idempotency_key,status) VALUES($1,$2,$3,'QUEUED') ON CONFLICT(workspace_id,idempotency_key) DO NOTHING", [workspaceId, mediaId, String(args.p_idempotency_key || randomId())]);
      await client.query("COMMIT");
      return { duplicate: false, media_id: mediaId, status: "QUEUED", plan, used: used + 1, remaining: limit < 0 ? null : limit - used - 1, cycle_end: cycleEnd.toISOString() };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  private async claimJob(client: PoolClient): Promise<DatabaseRow[]> {
    await client.query("BEGIN");
    try {
      const result = await client.query("WITH candidate AS (SELECT id FROM public.keeper_ai_jobs WHERE status IN ('QUEUED','PENDING','EXTRACTING','TRANSCRIBING','ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING') AND available_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE public.keeper_ai_jobs j SET status='EXTRACTING',attempts=j.attempts+1,locked_until=now()+interval '5 minutes',updated_at=now() FROM candidate WHERE j.id=candidate.id RETURNING j.*");
      await client.query("COMMIT"); return result.rows as DatabaseRow[];
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  private async updateCollection(client: PoolClient, args: DatabaseRow): Promise<null> {
    await client.query("BEGIN");
    try {
      const id = String(args.p_media_id || ""); const workspace = String(args.p_workspace_id || ""); const collectionId = args.p_collection_id ?? null;
      const row = await client.query("SELECT payload FROM public.keeper_media WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [id, workspace]);
      if (!row.rows[0]) throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
      if (collectionId && !(await client.query("SELECT 1 FROM public.keeper_collections WHERE workspace_id=$1 AND id=$2", [workspace, collectionId])).rows[0]) throw Object.assign(new Error("COLLECTION_NOT_FOUND"), { code: "P0002" });
      const payload = row.rows[0].payload as DatabaseRow; const metadata = payload.metadata as DatabaseRow || {};
      const collections = collectionId ? [collectionId] : [];
      const next = { ...payload, collectionId, collections, metadata: { ...metadata, aiOrganization: { ...(metadata.aiOrganization as DatabaseRow || {}), aiAssignedCollectionIds: [], manualCollectionIds: collections, autoOrganizationDisabled: collectionId === null } } };
      await client.query("UPDATE public.keeper_media SET payload=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3", [next, id, workspace]);
      await client.query("UPDATE public.keeper_media_analyses SET collection_id=$1,updated_at=now() WHERE media_id=$2 AND workspace_id=$3", [collectionId, id, workspace]);
      await client.query("INSERT INTO public.keeper_organization_corrections(workspace_id,media_id,from_collection_id,to_collection_id,media_tags,media_topic) VALUES($1,$2,$3,$4,$5,$6)", [workspace, id, payload.collectionId || null, collectionId, payload.tags || [], Array.isArray(payload.topics) ? payload.topics[0] || null : null]);
      await client.query("COMMIT"); return null;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  private async updateTags(client: PoolClient, args: DatabaseRow): Promise<null> {
    const id = String(args.p_media_id || ""); const workspace = String(args.p_workspace_id || "");
    const row = await client.query("SELECT payload FROM public.keeper_media WHERE id=$1 AND workspace_id=$2", [id, workspace]);
    if (!row.rows[0]) throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
    const payload = row.rows[0].payload as DatabaseRow; const metadata = payload.metadata as DatabaseRow || {};
    const tags = Array.isArray(args.p_tags) ? args.p_tags : []; const userTags = Array.isArray(args.p_user_tags) ? args.p_user_tags : []; const suppressed = Array.isArray(args.p_suppressed_ai_tags) ? args.p_suppressed_ai_tags : [];
    if (tags.length > 24 || userTags.length > 24 || suppressed.length > 24) throw Object.assign(new Error("TAG_LIMIT_EXCEEDED"), { code: "22023" });
    await client.query("UPDATE public.keeper_media SET payload=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3", [{ ...payload, tags, metadata: { ...metadata, userTags, suppressedAiTags: suppressed } }, id, workspace]); return null;
  }
  private async reprocess(client: PoolClient, args: DatabaseRow): Promise<DatabaseRow> {
    const id = String(args.p_media_id || ""); const workspace = String(args.p_workspace_id || ""); const payload = args.p_payload;
    if (typeof payload !== "object" || !payload) throw new Error("Reprocess payload is required.");
    await client.query("BEGIN");
    try {
      const row = await client.query("SELECT canonical_url FROM public.keeper_media WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [id, workspace]);
      if (!row.rows[0]) throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
      if ((payload as DatabaseRow).url !== row.rows[0].canonical_url) throw Object.assign(new Error("CANONICAL_URL_IMMUTABLE"), { code: "22023" });
      await client.query("UPDATE public.keeper_media SET payload=$1,processing_status='QUEUED',updated_at=now() WHERE id=$2 AND workspace_id=$3", [payload, id, workspace]);
      await client.query("INSERT INTO public.keeper_media_transcript_history(workspace_id,media_id,text,language,status,segments,provider,model_version,failure_reason,transcript_updated_at) SELECT workspace_id,media_id,text,language,status,segments,provider,model_version,failure_reason,updated_at FROM public.keeper_media_transcripts WHERE workspace_id=$1 AND media_id=$2", [workspace, id]);
      await client.query("DELETE FROM public.keeper_media_transcripts WHERE workspace_id=$1 AND media_id=$2", [workspace, id]);
      const result = await client.query("INSERT INTO public.keeper_ai_jobs(workspace_id,media_id,status,attempts,available_at,locked_until,last_error,idempotency_key) VALUES($1,$2,'QUEUED',0,now(),null,null,$3) ON CONFLICT(media_id) DO UPDATE SET status='QUEUED',attempts=0,available_at=now(),locked_until=null,last_error=null,idempotency_key=excluded.idempotency_key,updated_at=now() RETURNING id", [workspace, id, `reprocess:${id}:${randomId()}`]);
      await client.query("COMMIT"); return { job_id: result.rows[0].id, media_id: id, status: "QUEUED" };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  private async getOrCreateCollection(client: PoolClient, args: DatabaseRow): Promise<DatabaseRow> {
    const workspace = String(args.p_workspace_id || ""); const name = String(args.p_name || "").trim();
    if (!workspace || name.length < 4 || name.length > 120) throw Object.assign(new Error("INVALID_AI_COLLECTION"), { code: "22023" });
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || lower($2), 0))", [workspace, name]);
      const existing = await client.query("SELECT id,name,description FROM public.keeper_collections WHERE workspace_id=$1 AND lower(name)=lower($2) LIMIT 1 FOR UPDATE", [workspace, name]);
      if (existing.rows[0]) { await client.query("COMMIT"); return { ...existing.rows[0], created: false }; }
      const id = randomId(); const description = String(args.p_description || "").slice(0, 1000); const terms = Array.isArray(args.p_terms) ? args.p_terms : [];
      await client.query("INSERT INTO public.keeper_collections(workspace_id,id,name,description,profile,updated_at) VALUES($1,$2,$3,$4,$5,now())", [workspace, id, name, description, { topics: terms, tags: terms, createdBy: "keeper_ai" }]);
      await client.query("INSERT INTO public.keeper_collection_profiles(workspace_id,collection_id,terms,examples,updated_at) VALUES($1,$2,$3,0,now()) ON CONFLICT(workspace_id,collection_id) DO UPDATE SET terms=excluded.terms,updated_at=now()", [workspace, id, terms]);
      await client.query("COMMIT"); return { id, name, description, created: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  private async recordAssignment(client: PoolClient, args: DatabaseRow): Promise<null> {
    const workspace = String(args.p_workspace_id || ""); const mediaId = String(args.p_media_id || "");
    const tags = Array.isArray(args.p_tags) ? args.p_tags : [];
    await client.query("INSERT INTO public.keeper_workspace_assignments(workspace_id,media_id,collection_id,topic,tags,assigned_at) VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(workspace_id,media_id) DO UPDATE SET collection_id=excluded.collection_id,topic=excluded.topic,tags=excluded.tags,assigned_at=now()", [workspace, mediaId, args.p_collection_id ?? null, args.p_topic ?? null, tags]);
    return null;
  }
}

function randomId(): string { return randomUUID(); }

export async function closePostgresPool(): Promise<void> { await pool.end(); }
