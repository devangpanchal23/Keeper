import "server-only";

export type DatabaseRow = Record<string, unknown>;
export type QueryResult = { data: DatabaseRow[] | null; error: { code?: string; message: string } | null; count?: number | null };
export type Filter = { column: string; operator: "eq" | "in" | "gte" | "lte" | "lt" | "is"; value: unknown };
export type QueryOperation = "select" | "insert" | "upsert" | "update" | "delete";

export interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): this;
  eq(column: string, value: unknown): this;
  is(column: string, value: null | boolean): this;
  in(column: string, values: unknown[]): this;
  gte(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): this;
  maybeSingle(): Promise<{ data: DatabaseRow | null; error: QueryResult["error"] }>;
  single(): Promise<{ data: DatabaseRow | null; error: QueryResult["error"] }>;
  insert(values: DatabaseRow | DatabaseRow[]): this;
  upsert(values: DatabaseRow | DatabaseRow[], options?: { onConflict?: string }): this;
  update(values: DatabaseRow): this;
  delete(): this;
}

export interface BackendStore {
  from(table: string): QueryBuilder;
  rpc(name: string, args?: DatabaseRow): Promise<{ data: unknown; error: QueryResult["error"] }>;
}

export function asDatabaseRows(value: unknown): DatabaseRow[] {
  if (Array.isArray(value)) return value.filter(isDatabaseRow);
  return isDatabaseRow(value) ? [value] : [];
}

export function isDatabaseRow(value: unknown): value is DatabaseRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorResult(error: unknown): QueryResult["error"] {
  if (error instanceof Error) {
    const rawCode = "code" in error ? error.code : undefined;
    const code = rawCode === 11000 ? "23505" : typeof rawCode === "string" ? rawCode : undefined;
    return { ...(code ? { code } : {}), message: error.message };
  }
  return { message: "Database operation failed." };
}
