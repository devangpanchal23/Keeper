import {
  Collection,
  DuplicateStrategy,
  FailureCategory,
  ImportItem,
  ImportItemFailure,
  ImportJob,
  ImportJobOptions,
  ImportJobStatus,
  ImportMethod,
  ImportReport,
  IngestionResult,
  Platform,
  PreImportAnalysisBreakdown,
  SavedItem,
} from "@/types";
import { IngestionService } from "../ingestion-service";
import { ProviderRegistry } from "../providers/provider-registry";
import { ContentService } from "../content-service";
import { StorageService } from "../storage-service";
import { ParsedImportCandidate } from "./export-parser";

const STORAGE_KEYS = {
  ACTIVE_JOB_PREFIX: "keeper_import_job_user_",
  REPORTS_PREFIX: "keeper_import_reports_user_",
};

type ProgressCallback = (job: ImportJob) => void;

// Shared server & client in-memory cache
const globalJobsStore = new Map<string, ImportJob>();
const globalReportsStore = new Map<string, ImportReport[]>();
const cancellationTokens = new Map<string, boolean>();
const pauseTokens = new Map<string, boolean>();
const progressSubscribers = new Map<string, Set<ProgressCallback>>();

export class ImportJobService {
  // ---------------------------------------------------------------------------
  // Subscription / Live Event Listeners
  // ---------------------------------------------------------------------------

  public static subscribeProgress(jobId: string, callback: ProgressCallback): () => void {
    if (!progressSubscribers.has(jobId)) {
      progressSubscribers.set(jobId, new Set());
    }
    progressSubscribers.get(jobId)!.add(callback);
    return () => {
      progressSubscribers.get(jobId)?.delete(callback);
    };
  }

  private static notifyProgress(job: ImportJob): void {
    // Notify in-memory listeners
    const listeners = progressSubscribers.get(job.id);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb({ ...job, items: [...job.items] });
        } catch {}
      });
    }
    // Persist to storage
    this.saveJobToStorage(job);
  }

  // ---------------------------------------------------------------------------
  // Storage Persistence (Durable Across Page Refreshes & Server Resilient)
  // ---------------------------------------------------------------------------

  private static isClient(): boolean {
    return typeof window !== "undefined";
  }

  public static saveJobToStorage(job: ImportJob): void {
    globalJobsStore.set(job.id, job);
    if (!this.isClient()) return;
    try {
      const key = `${STORAGE_KEYS.ACTIVE_JOB_PREFIX}${job.userId}`;
      localStorage.setItem(key, JSON.stringify(job));
    } catch (e) {
      console.error("Failed to persist import job to localStorage", e);
    }
  }

  public static getJobById(jobId: string, userId?: string): ImportJob | null {
    const job = globalJobsStore.get(jobId);
    if (job) {
      if (userId && job.userId !== userId) return null; // Security isolation check
      return job;
    }
    if (this.isClient() && userId) {
      const active = this.getActiveJob(userId);
      if (active && active.id === jobId) return active;
    }
    return null;
  }

  public static getActiveJob(userId: string): ImportJob | null {
    if (this.isClient()) {
      try {
        const key = `${STORAGE_KEYS.ACTIVE_JOB_PREFIX}${userId}`;
        const data = localStorage.getItem(key);
        if (data) {
          const parsed: ImportJob = JSON.parse(data);
          globalJobsStore.set(parsed.id, parsed);
          return parsed;
        }
      } catch {}
    }
    for (const job of globalJobsStore.values()) {
      if (
        job.userId === userId &&
        (job.status === "processing" || job.status === "paused" || job.status === "ready")
      ) {
        return job;
      }
    }
    return null;
  }

  public static clearActiveJob(userId: string): void {
    for (const [id, job] of globalJobsStore.entries()) {
      if (job.userId === userId) {
        globalJobsStore.delete(id);
      }
    }
    if (this.isClient()) {
      try {
        const key = `${STORAGE_KEYS.ACTIVE_JOB_PREFIX}${userId}`;
        localStorage.removeItem(key);
      } catch {}
    }
  }

  // ---------------------------------------------------------------------------
  // Pre-Import Analysis (5-Way Breakdown: Detected, Ready, Already Saved, Duplicates, Unsupported)
  // ---------------------------------------------------------------------------

  public static analyzeCandidates(
    candidates: ParsedImportCandidate[],
    existingItems: SavedItem[],
    targetPlatform?: Platform | "all"
  ): PreImportAnalysisBreakdown & {
    duplicates: number;
    newItems: number;
  } {
    const registry = ProviderRegistry.getInstance();
    const existingUrlSet = new Set(
      existingItems.filter((i) => !i.trashed).map((i) => i.url.toLowerCase().trim())
    );

    const seenInBatch = new Set<string>();
    const candidateItems: ImportItem[] = [];

    let readyCount = 0;
    let alreadySavedCount = 0;
    let batchDuplicateCount = 0;
    let unsupportedCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const trimmedUrl = (c.originalUrl || "").trim();

      // Check URL validity
      if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
        unsupportedCount++;
        candidateItems.push({
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          jobId: "",
          originalUrl: trimmedUrl,
          canonicalUrl: trimmedUrl,
          platform: "website",
          contentType: "other",
          title: c.title || trimmedUrl,
          status: "unsupported",
          error: {
            code: "ERR_INVALID_SCHEME",
            provider: "website",
            stage: "validation",
            message: "Invalid URL scheme. Must begin with http:// or https://",
            category: "invalid_url",
            isRetryable: false,
            userActionRequired: true,
            suggestedAction: "Check and correct the URL string.",
          },
          retryCount: 0,
        });
        continue;
      }

      const provider = registry.getProviderForUrl(trimmedUrl);
      const validation = provider.validateAndCanonicalize(trimmedUrl);

      if (!validation.isValid) {
        unsupportedCount++;
        candidateItems.push({
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          jobId: "",
          originalUrl: trimmedUrl,
          canonicalUrl: validation.canonicalUrl || trimmedUrl,
          platform: validation.platform || "website",
          contentType: validation.contentType || "other",
          title: c.title || trimmedUrl,
          status: "unsupported",
          error: {
            code: "ERR_VALIDATION_FAILED",
            provider: validation.platform,
            stage: "validation",
            message: validation.error || "Could not validate platform content identifier.",
            category: "invalid_url",
            isRetryable: false,
            userActionRequired: true,
            suggestedAction: "Verify that this link points to a valid post or video.",
          },
          retryCount: 0,
        });
        continue;
      }

      const canonical = validation.canonicalUrl.toLowerCase().trim();
      const isAlreadyInKeeper = existingUrlSet.has(canonical);
      const isDuplicateInBatch = seenInBatch.has(canonical);

      // Validate target platform if specified (for YouTube + Shorts and Instagram + Reels)
      if (
        targetPlatform && targetPlatform !== "all" &&
        targetPlatform !== validation.platform &&
        !(targetPlatform === "youtube" && validation.platform === "youtube-shorts")
      ) {
        unsupportedCount++;
        candidateItems.push({
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          jobId: "",
          originalUrl: trimmedUrl,
          canonicalUrl: validation.canonicalUrl || trimmedUrl,
          platform: validation.platform || "website",
          contentType: validation.contentType || "other",
          title: c.title || trimmedUrl,
          status: "unsupported",
          error: {
            code: "ERR_UNSUPPORTED_PLATFORM",
            provider: validation.platform,
            stage: "validation",
            message: `URL does not match selected source (${targetPlatform === "youtube" ? "YouTube + YouTube Shorts" : "Instagram + Instagram Reels"}).`,
            category: "invalid_url",
            isRetryable: false,
            userActionRequired: true,
            suggestedAction: `Ensure this link is a valid ${targetPlatform === "youtube" ? "YouTube video or Short" : "Instagram post or Reel"}.`,
          },
          retryCount: 0,
        });
        continue;
      }

      let itemStatus: ImportItem["status"] = "pending";

      if (isAlreadyInKeeper) {
        alreadySavedCount++;
        itemStatus = "duplicate";
      } else if (isDuplicateInBatch) {
        batchDuplicateCount++;
        itemStatus = "duplicate";
      } else {
        readyCount++;
      }

      seenInBatch.add(canonical);

      candidateItems.push({
        id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: "",
        originalUrl: c.originalUrl,
        canonicalUrl: validation.canonicalUrl,
        externalId: validation.contentId || undefined,
        platform: validation.platform,
        contentType: validation.contentType,
        title: c.title || validation.canonicalUrl,
        creatorName: c.creatorName || (c.title && !c.title.includes(" ") && !c.title.startsWith("http") ? c.title : undefined),
        caption: c.caption,
        hashtags: c.hashtags,
        fbid: c.fbid,
        thumbnailUrl: c.thumbnailUrl,
        collectionId: c.collectionId,
        collectionName: c.collectionName || c.sourceContext || undefined,
        savedTimestamp: c.savedTimestamp,
        status: itemStatus,
        retryCount: 0,
      });
    }

    const totalDuplicates = alreadySavedCount + batchDuplicateCount;

    return {
      total: candidates.length,
      ready: readyCount,
      alreadySaved: alreadySavedCount,
      batchDuplicates: batchDuplicateCount,
      unsupported: unsupportedCount,
      candidateItems,
      // Backward compatibility convenience fields
      duplicates: totalDuplicates,
      newItems: readyCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Create & Start Import Job
  // ---------------------------------------------------------------------------

  public static createJob(params: {
    userId: string;
    platform: Platform;
    sourceType: ImportMethod;
    sourceName: string;
    items: ImportItem[];
    options: ImportJobOptions;
  }): ImportJob;
  public static createJob(
    userId: string,
    platform: Platform,
    sourceType: ImportMethod,
    candidates: any[],
    options?: Partial<ImportJobOptions>
  ): Promise<ImportJob>;
  public static createJob(
    paramsOrUserId:
      | {
          userId: string;
          platform: Platform;
          sourceType: ImportMethod;
          sourceName: string;
          items: ImportItem[];
          options: ImportJobOptions;
        }
      | string,
    platformArg?: Platform,
    sourceTypeArg?: ImportMethod,
    candidatesArg?: any[],
    optionsArg?: Partial<ImportJobOptions>
  ): any {
    if (typeof paramsOrUserId === "string") {
      const userId = paramsOrUserId;
      const platform = platformArg || "instagram";
      const sourceType = sourceTypeArg || "export_file";
      const rawCandidates = candidatesArg || [];
      const userOptions: ImportJobOptions = {
        autoOrganize: false,
        skipDuplicates: false,
        defaultTags: [],
        concurrencyLimit: 3,
        duplicateStrategy: "update",
        ...optionsArg,
      };

      const existingItems = StorageService.getItems(userId);
      const analysis = this.analyzeCandidates(rawCandidates, existingItems);
      return Promise.resolve(
        this.createJob({
          userId,
          platform,
          sourceType,
          sourceName: "Import",
          items: analysis.candidateItems,
          options: userOptions,
        })
      );
    }

    const params = paramsOrUserId;
    // Validate collection ownership if targetCollectionId or item.collectionId are specified
    if (params.userId) {
      const userCollections = StorageService.getCollections(params.userId);
      const validCollectionIds = new Set(userCollections.map((c) => c.id));

      if (params.options.targetCollectionId && !validCollectionIds.has(params.options.targetCollectionId)) {
        throw new Error(
          `Unauthorized collection assignment: targetCollectionId '${params.options.targetCollectionId}' does not belong to user '${params.userId}'.`
        );
      }

      for (const it of params.items) {
        if (it.collectionId && !validCollectionIds.has(it.collectionId)) {
          throw new Error(
            `Unauthorized collection assignment: item collectionId '${it.collectionId}' does not belong to user '${params.userId}'.`
          );
        }
      }
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const items = params.items.map((it) => ({ ...it, jobId }));

    const job: ImportJob = {
      id: jobId,
      userId: params.userId,
      platform: params.platform,
      sourceType: params.sourceType,
      sourceName: params.sourceName,
      status: "ready",
      totalItems: items.length,
      processedItems: 0,
      successCount: 0,
      duplicateCount: items.filter((i) => i.status === "duplicate").length,
      failedCount: 0,
      skippedCount: 0,
      createdAt: new Date().toISOString(),
      options: {
        targetCollectionId: params.options.targetCollectionId,
        autoOrganize: params.options.autoOrganize ?? true,
        skipDuplicates: params.options.skipDuplicates ?? true,
        duplicateStrategy: params.options.duplicateStrategy || (params.options.skipDuplicates ? "skip" : "update"),
        aiEnrichmentMode: params.options.aiEnrichmentMode || "full",
        defaultTags: params.options.defaultTags || [],
        concurrencyLimit: params.options.concurrencyLimit || 3,
      },
      items,
    };

    cancellationTokens.set(jobId, false);
    pauseTokens.set(jobId, false);
    this.saveJobToStorage(job);
    return job;
  }

  // ---------------------------------------------------------------------------
  // Job Execution Engine (Item State Machine, Concurrency, Retries, Diagnostics)
  // ---------------------------------------------------------------------------

  public static async processJob(jobId: string): Promise<ImportReport> {
    return this.startJob(jobId);
  }

  public static async startJob(jobId: string): Promise<ImportReport> {
    const job = globalJobsStore.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found.`);
    }

    // Check quota limits before starting job
    const initialLimits = StorageService.getImportLimits(job.userId);
    if (initialLimits.remaining <= 0) {
      throw new Error("Import limit reached: 0 remaining imports. Upgrade or reset your limits to continue.");
    }

    job.status = "processing";
    job.startedAt = job.startedAt || new Date().toISOString();
    cancellationTokens.set(jobId, false);
    pauseTokens.set(jobId, false);
    this.notifyProgress(job);

    const concurrency = Math.min(job.options.concurrencyLimit || 3, 5);
    const dupStrategy: DuplicateStrategy = job.options.duplicateStrategy || (job.options.skipDuplicates ? "skip" : "update");

    // Filter items to process
    const itemsToProcess = job.items.filter((it) => {
      if (it.status === "unsupported") return false;

      if (it.status === "duplicate") {
        if (dupStrategy === "skip") {
          it.status = "skipped";
          job.skippedCount++;
          return false;
        }
        // If strategy is "update" or "allow", allow it to be processed
        it.status = "pending";
        return true;
      }

      return (
        it.status === "pending" ||
        (it.status === "failed" && it.error?.isRetryable !== false && it.retryCount < 3)
      );
    });

    const startTime = Date.now();
    const existingCollections = StorageService.getCollections(job.userId);

    // Queue worker pool
    let currentIndex = 0;

    const processNext = async (): Promise<void> => {
      while (currentIndex < itemsToProcess.length) {
        // Check for cancellation
        if (cancellationTokens.get(jobId)) {
          job.status = "cancelled";
          this.notifyProgress(job);
          return;
        }

        // Check for pause
        if (pauseTokens.get(jobId)) {
          job.status = "paused";
          job.pausedAt = new Date().toISOString();
          this.notifyProgress(job);
          return;
        }

        const item = itemsToProcess[currentIndex++];
        if (!item) break;

        // Stage 1: PROCESSING / EXTRACTING
        item.status = "extracting";
        this.notifyProgress(job);

        // Check remaining import limits quota before ingesting item
        const currentLimits = StorageService.getImportLimits(job.userId);
        if (typeof window === "undefined" && currentLimits.remaining <= 0) {
          item.status = "failed";
          item.retryCount = (item.retryCount || 0) + 1;
          item.error = {
            code: "ERR_IMPORT_LIMIT_EXCEEDED",
            provider: item.platform,
            stage: "enrichment",
            message: "Import limit reached (0 remaining). Quota exhausted.",
            category: "rate_limit",
            isRetryable: false,
            userActionRequired: true,
            suggestedAction: "Reset or upgrade your import quota to import more items.",
          };
          item.processedAt = new Date().toISOString();
          job.failedCount++;
          job.processedItems++;
          this.notifyProgress(job);
          continue;
        }

        try {
          // Browser imports go through the authenticated server boundary, where
          // the credit ledger and durable AI queue are committed atomically.
          const initialMetadata = {
            title: item.title,
            creatorName: item.creatorName,
            caption: item.caption,
            hashtags: item.hashtags,
            fbid: item.fbid,
            thumbnailUrl: item.thumbnailUrl,
            savedTimestamp: item.savedTimestamp,
            collectionName: item.collectionName,
          };
          let ingestion: IngestionResult;
          if (typeof window !== "undefined") {
            const response = await fetch("/api/ingest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: item.originalUrl,
                customCollectionId: item.collectionId || job.options.targetCollectionId,
                initialMetadata,
                collections: existingCollections,
                idempotencyKey: `${job.id}:${item.id}`,
              }),
            });
            const payload = await response.json() as { success?: boolean; error?: string; data?: IngestionResult };
            if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || "Server import failed.");
            ingestion = payload.data;
            ContentService.addItem(ingestion.savedItem, job.userId, dupStrategy);
          } else {
            ingestion = await IngestionService.processUrl(item.originalUrl, {
              userId: job.userId,
              customCollectionId: item.collectionId || job.options.targetCollectionId,
              existingCollections,
              aiEnrichmentMode: "fast_metadata",
              duplicateStrategy: dupStrategy,
              initialMetadata,
            });
          }

          // Stage 2: SAVING -> COMPLETED / SUCCESS
          item.status = "success";
          item.savedItemId = ingestion.savedItem.id;
          item.canonicalUrl = ingestion.sourceData.canonicalUrl;
          item.title = ingestion.sourceData.title;
          item.creatorName = ingestion.sourceData.creator.name;
          item.collectionId = ingestion.savedItem.collectionId;
          const assignedCol = existingCollections.find((c) => c.id === item.collectionId);
          item.collectionName = assignedCol?.name || ingestion.aiEnrichment.suggestedCollectionName;
          item.processedAt = new Date().toISOString();

          job.successCount++;
          // Automatically deduct 1 limit per successfully imported item
          StorageService.deductImportLimit(1, job.userId);
        } catch (err: any) {
          item.status = "failed";
          item.retryCount = (item.retryCount || 0) + 1;
          item.error = this.classifyFailure(err, item.platform);
          item.processedAt = new Date().toISOString();
          job.failedCount++;
        }

        job.processedItems++;

        // Calculate estimated seconds remaining
        const elapsed = (Date.now() - startTime) / 1000;
        const avgPerItem = elapsed / Math.max(1, job.processedItems);
        const remainingItems = job.totalItems - job.processedItems;
        job.estimatedSecondsRemaining = Math.max(0, Math.round(remainingItems * avgPerItem));

        this.notifyProgress(job);

        // Small bounded rate-limiting delay between items
        await new Promise((r) => setTimeout(r, 120));
      }
    };

    // Spawn concurrent bounded workers
    const workers: Promise<void>[] = [];
    for (let w = 0; w < concurrency; w++) {
      workers.push(processNext());
    }
    await Promise.all(workers);

    // Finalize job status if not paused or cancelled
    const currentStatus = job.status as ImportJobStatus;
    if (currentStatus !== "paused" && currentStatus !== "cancelled") {
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.estimatedSecondsRemaining = 0;
      this.notifyProgress(job);
    }

    // Generate persistent report
    const report = this.generateReport(job);
    this.saveReport(report);
    return report;
  }

  public static pauseJob(jobId: string): void {
    pauseTokens.set(jobId, true);
    const job = globalJobsStore.get(jobId);
    if (job) {
      job.status = "paused";
      job.pausedAt = new Date().toISOString();
      this.notifyProgress(job);
    }
  }

  public static resumeJob(jobId: string): Promise<ImportReport> {
    pauseTokens.set(jobId, false);
    return this.startJob(jobId);
  }

  public static cancelJob(jobId: string): void {
    cancellationTokens.set(jobId, true);
    const job = globalJobsStore.get(jobId);
    if (job) {
      job.status = "cancelled";
      this.notifyProgress(job);
    }
  }

  /**
   * Retries all failed retryable items in a completed or paused job
   */
  public static async retryFailedItems(jobId: string, userId?: string): Promise<ImportReport> {
    const job = globalJobsStore.get(jobId);
    if (!job) throw new Error("Job not found");

    if (userId && job.userId !== userId) {
      throw new Error("Unauthorized: Cannot retry import job belonging to another user.");
    }

    job.items.forEach((it) => {
      // Retry only retryable failures (deleted/private permanent failures must not enter infinite retry loops)
      if (it.status === "failed" && it.error?.isRetryable !== false) {
        it.status = "pending";
        job.failedCount = Math.max(0, job.failedCount - 1);
        job.processedItems = Math.max(0, job.processedItems - 1);
      }
    });

    job.status = "ready";
    return this.startJob(jobId);
  }

  // ---------------------------------------------------------------------------
  // Failure Classification & Structured Diagnostics
  // ---------------------------------------------------------------------------

  public static classifyFailure(err: any, platform?: Platform): ImportItemFailure {
    const plat = platform || "website";

    if (err instanceof ReferenceError || err instanceof TypeError) {
      return {
        code: "ERR_INTERNAL_ERROR",
        provider: plat,
        stage: "extraction",
        message: err.message,
        category: "unknown",
        isRetryable: false,
        userActionRequired: false,
        suggestedAction: "Internal error occurred. Please report this issue.",
      };
    }

    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) {
      return {
        code: "ERR_RATE_LIMITED",
        provider: plat,
        stage: "extraction",
        message: "Platform rate limit reached. Retryable with backoff.",
        category: "rate_limit",
        isRetryable: true,
        userActionRequired: false,
        suggestedAction: "Wait a minute and click 'Retry Failed Items'.",
      };
    }

    if (
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("operation was aborted") ||
      msg.includes("aborterror") ||
      msg.includes("signal is aborted") ||
      msg.includes("econnreset")
    ) {
      return {
        code: "ERR_TIMEOUT",
        provider: plat,
        stage: "network",
        message: "Network timeout while fetching content metadata.",
        category: "timeout",
        isRetryable: true,
        userActionRequired: false,
        suggestedAction: "Check your internet connection and retry.",
      };
    }

    if (
      msg.includes("login") ||
      msg.includes("private") ||
      msg.includes("deleted") ||
      msg.includes("unavailable") ||
      msg.includes("restricted")
    ) {
      return {
        code: "ERR_CONTENT_UNAVAILABLE",
        provider: plat,
        stage: "extraction",
        message: "Content is private, deleted, or requires platform account login.",
        category: "unavailable",
        isRetryable: false,
        userActionRequired: true,
        suggestedAction: "Verify that this post or video is publicly accessible.",
      };
    }

    if (msg.includes("invalid") || msg.includes("malformed") || msg.includes("extract")) {
      return {
        code: "ERR_INVALID_URL",
        provider: plat,
        stage: "validation",
        message: "URL format is invalid or missing video/post identifier.",
        category: "invalid_url",
        isRetryable: false,
        userActionRequired: true,
        suggestedAction: "Check and correct the URL string.",
      };
    }

    return {
      code: "ERR_INGESTION_UNKNOWN",
      provider: plat,
      stage: "extraction",
      message: err instanceof Error ? err.message : "Unexpected ingestion failure.",
      category: "unknown",
      isRetryable: true,
      userActionRequired: false,
      suggestedAction: "Retry the import item.",
    };
  }

  // ---------------------------------------------------------------------------
  // Persistent Import Reports
  // ---------------------------------------------------------------------------

  public static generateReport(job: ImportJob): ImportReport {
    const durationMs =
      new Date(job.completedAt || new Date()).getTime() -
      new Date(job.startedAt || job.createdAt).getTime();

    const eligible = job.totalItems - job.duplicateCount;
    const successPercentage =
      job.processedItems > 0 ? Math.round((job.successCount / job.processedItems) * 100) : 0;

    const unsupportedCount = job.items.filter((i) => i.status === "unsupported").length;

    return {
      id: `report-${job.id}`,
      jobId: job.id,
      userId: job.userId,
      platform: job.platform,
      accountName: job.userId === "user-demo-1" ? "Demo User" : "Connected Account",
      sourceName: job.sourceName,
      startedAt: job.startedAt || job.createdAt,
      completedAt: job.completedAt || new Date().toISOString(),
      durationMs: Math.max(0, durationMs),
      summary: {
        totalDiscovered: job.totalItems,
        alreadyExisted: job.duplicateCount,
        eligible,
        imported: job.successCount,
        failed: job.failedCount,
        skipped: job.skippedCount,
        duplicates: job.duplicateCount,
        unsupported: unsupportedCount,
        successPercentage,
      },
      items: [...job.items],
    };
  }

  public static saveReport(report: ImportReport): void {
    const userReports = globalReportsStore.get(report.userId) || [];
    const filtered = userReports.filter((r) => r.id !== report.id);
    globalReportsStore.set(report.userId, [report, ...filtered].slice(0, 30));

    if (!this.isClient()) return;
    try {
      const key = `${STORAGE_KEYS.REPORTS_PREFIX}${report.userId}`;
      const existing = this.getReports(report.userId);
      const filteredExisting = existing.filter((r) => r.id !== report.id);
      localStorage.setItem(key, JSON.stringify([report, ...filteredExisting].slice(0, 30)));
    } catch (e) {
      console.error("Failed to save import report", e);
    }
  }

  public static getReports(userId: string): ImportReport[] {
    const memoryReports = globalReportsStore.get(userId) || [];
    if (!this.isClient()) return memoryReports;
    try {
      const key = `${STORAGE_KEYS.REPORTS_PREFIX}${userId}`;
      const data = localStorage.getItem(key);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : memoryReports;
    } catch {
      return memoryReports;
    }
  }

  public static getReportById(userId: string, reportId: string): ImportReport | null {
    const reports = this.getReports(userId);
    return reports.find((r) => r.id === reportId) || null;
  }
}
