export interface OssImportLedgerEntry {
  event_type: "FREE_IMPORT";
  plan: "free";
  amount: 1;
  cycle_start: string;
  cycle_end: string;
}

export interface OssImportCycle {
  cycleStart: Date;
  cycleEnd: Date;
}

export interface OssImportEntitlement {
  plan: "free";
  unlimited: true;
  limit: null;
}

/** OSS product entitlement is independent of historical billing records and usage totals. */
export function getOssImportEntitlement(): OssImportEntitlement {
  return { plan: "free", unlimited: true, limit: null };
}

const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

/** The OSS ledger uses recurring seven-day windows anchored to workspace creation. */
export function getOssImportCycle(now: Date, anchor: Date): OssImportCycle {
  const elapsedWeeks = Math.floor((now.getTime() - anchor.getTime()) / WEEK_MILLISECONDS);
  const cycleStart = new Date(anchor.getTime() + elapsedWeeks * WEEK_MILLISECONDS);
  return { cycleStart, cycleEnd: new Date(cycleStart.getTime() + WEEK_MILLISECONDS) };
}

/** Usage is recorded only after a newly created import is committed. */
export function createOssImportLedgerEntry(
  outcome: "created" | "duplicate" | "noop",
  cycle?: OssImportCycle,
): OssImportLedgerEntry | null {
  if (outcome !== "created") return null;
  if (!cycle) throw new Error("OSS import ledger entries require cycle timestamps.");
  return {
    event_type: "FREE_IMPORT",
    plan: "free",
    amount: 1,
    cycle_start: cycle.cycleStart.toISOString(),
    cycle_end: cycle.cycleEnd.toISOString(),
  };
}
