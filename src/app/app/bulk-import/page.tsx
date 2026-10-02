"use client";

import React, { useState, useEffect } from "react";
import { useRecall } from "@/context/RecallContext";
import {
  Collection,
  ImportJob,
  ImportJobOptions,
  ImportMethod,
  ImportReport,
  Platform,
  PreImportAnalysisBreakdown,
} from "@/types";
import { PlatformCard } from "@/components/bulk-import/PlatformCard";
import { ImportSourceSelector } from "@/components/bulk-import/ImportSourceSelector";
import { PreImportAnalysis } from "@/components/bulk-import/PreImportAnalysisModal";
import { LiveProgressTracker } from "@/components/bulk-import/LiveProgressTracker";
import { ImportReportView } from "@/components/bulk-import/ImportReportView";
import { HistoricalReportsList } from "@/components/bulk-import/HistoricalReportsList";
import { InstagramExportGuideModal } from "@/components/bulk-import/InstagramExportGuideModal";
import { InstagramCollectionMapper } from "@/components/bulk-import/InstagramCollectionMapper";
import { ExportFileParser, ParsedImportCandidate } from "@/services/bulk-import/export-parser";
import {
  InstagramExportAdapter,
  InstagramExportAnalysis,
} from "@/services/bulk-import/adapters/instagram-export-adapter";
import { ImportJobService } from "@/services/bulk-import/import-job-service";
import { CollectionService } from "@/services/collection-service";
import { StorageService } from "@/services/storage-service";
import {
  UploadCloud,
  Layers,
  Clock,
  ArrowLeft,
  Sparkles,
  FileCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ImportStep =
  | "platform_selection"
  | "source_selection"
  | "collection_mapping"
  | "pre_import_analysis"
  | "live_progress"
  | "report_view";

export default function BulkImportPage() {
  const { user, collections, items, addToast, createCollection } = useRecall();
  const userId = user?.id || "user-demo-1";

  const [step, setStep] = useState<ImportStep>("platform_selection");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("youtube");
  const [selectedMethod, setSelectedMethod] = useState<ImportMethod>("file_export");

  // Instagram-specific acquisition state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [instagramAnalysis, setInstagramAnalysis] = useState<InstagramExportAnalysis | null>(null);

  // Candidates & Job state
  const [candidates, setCandidates] = useState<ParsedImportCandidate[]>([]);
  const [analysisResult, setAnalysisResult] = useState<(PreImportAnalysisBreakdown & { duplicates: number; newItems: number }) | null>(null);

  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [currentReport, setCurrentReport] = useState<ImportReport | null>(null);
  const [historicalReports, setHistoricalReports] = useState<ImportReport[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  // Load existing active job or historical reports on mount
  useEffect(() => {
    const existingJob = ImportJobService.getActiveJob(userId);
    if (existingJob && (existingJob.status === "processing" || existingJob.status === "paused")) {
      setActiveJob(existingJob);
      setStep("live_progress");
    }

    const pastReports = ImportJobService.getReports(userId);
    setHistoricalReports(pastReports);
  }, [userId]);

  // Subscribe to live job progress updates
  useEffect(() => {
    if (!activeJob) return;

    const unsubscribe = ImportJobService.subscribeProgress(activeJob.id, (updatedJob) => {
      setActiveJob(updatedJob);
      if (updatedJob.status === "completed") {
        const report = ImportJobService.generateReport(updatedJob);
        setCurrentReport(report);
        setHistoricalReports(ImportJobService.getReports(userId));
        setStep("report_view");
        addToast(
          "Import Completed",
          `Successfully processed ${updatedJob.successCount} items from ${updatedJob.sourceName}.`,
          "success"
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeJob?.id, userId, addToast]);

  // ---------------------------------------------------------------------------
  // Candidate Handlers
  // ---------------------------------------------------------------------------

  const handlePlatformSelect = (p: Platform) => {
    setSelectedPlatform(p);
    setInstagramAnalysis(null);
    setStep("source_selection");
  };

  const handleFileLoaded = (content: string, filename: string) => {
    if (selectedPlatform === "instagram") {
      const igResult = InstagramExportAdapter.parse(content, filename);
      if (!igResult.isValid || igResult.candidates.length === 0) {
        addToast(
          "Instagram Parse Notice",
          igResult.error || igResult.warnings[0] || "No saved Instagram content found in file.",
          "error"
        );
        return;
      }

      if (igResult.collections.length > 0) {
        setInstagramAnalysis(igResult);
        setStep("collection_mapping");
        return;
      }

      // No named collections, proceed directly to analysis with candidates
      proceedToAnalysis(igResult.candidates, "Instagram Saved Posts");
      return;
    }

    // Default multi-platform parser
    const parsed = ExportFileParser.parse(content, filename);
    if (parsed.length === 0) {
      addToast("Parse Error", "No recognizable video, post, or bookmark URLs found in the uploaded file.", "error");
      return;
    }
    proceedToAnalysis(parsed, filename);
  };

  const handleArchiveLoaded = async (buffer: ArrayBuffer, filename: string) => {
    if (selectedPlatform === "instagram") {
      addToast("Analyzing Archive", `Extracting structured JSON files from ${filename}...`, "info");
      const igResult = await InstagramExportAdapter.parseZipArchive(buffer);
      if (!igResult.isValid || igResult.candidates.length === 0) {
        addToast(
          "Archive Parse Notice",
          igResult.error || igResult.warnings[0] || "No saved Instagram content found in ZIP archive.",
          "error"
        );
        return;
      }

      if (igResult.collections.length > 0) {
        setInstagramAnalysis(igResult);
        setStep("collection_mapping");
        return;
      }

      proceedToAnalysis(igResult.candidates, "Instagram Export Archive");
      return;
    }

    addToast("Unsupported Archive", "ZIP archive extraction is currently configured for Meta/Instagram exports.", "warning");
  };

  const handleMultipleFilesLoaded = (files: Array<{ content: string; filename: string }>) => {
    if (selectedPlatform === "instagram") {
      const igResult = InstagramExportAdapter.parseMultipleJsonFiles(files);
      if (!igResult.isValid || igResult.candidates.length === 0) {
        addToast(
          "Multiple Files Notice",
          igResult.error || "No saved Instagram content found in selected files.",
          "error"
        );
        return;
      }

      if (igResult.collections.length > 0) {
        setInstagramAnalysis(igResult);
        setStep("collection_mapping");
        return;
      }

      proceedToAnalysis(igResult.candidates, "Instagram Export Files");
      return;
    }

    // Default: aggregate parsed files
    const allParsed: ParsedImportCandidate[] = [];
    for (const f of files) {
      allParsed.push(...ExportFileParser.parse(f.content, f.filename));
    }
    if (allParsed.length === 0) {
      addToast("Parse Error", "No recognizable content found in selected files.", "error");
      return;
    }
    proceedToAnalysis(allParsed, "Batch File Import");
  };

  const handleCollectionMappingConfirmed = (mappedCandidates: ParsedImportCandidate[]) => {
    proceedToAnalysis(mappedCandidates, "Instagram Saved Collections");
  };

  const handleCreateCollection = (name: string): Collection => {
    if (createCollection) {
      return createCollection({
        name,
        description: `Imported from Instagram Collection "${name}"`,
        icon: "Folder",
        color: "#EC4899",
      });
    }
    return CollectionService.create({
      name,
      description: `Imported from Instagram Collection "${name}"`,
      icon: "Folder",
      color: "#EC4899",
    });
  };

  const handleUrlsSubmitted = (rawUrls: string) => {
    const parsed = ExportFileParser.parseRawUrlList(rawUrls);
    if (parsed.length === 0) {
      addToast("Invalid URLs", "Please enter at least one valid URL to import.", "error");
      return;
    }
    proceedToAnalysis(parsed, "Direct URL Batch");
  };

  const handleOAuthConnect = () => {
    addToast(
      "OAuth Connected",
      "Connected Google / YouTube Account securely.",
      "success"
    );
    // Real API sample sync for YouTube + YouTube Shorts
    const sampleUrls: ParsedImportCandidate[] = [
      { originalUrl: "https://www.youtube.com/watch?v=3lZF8W_AaUo", platform: "youtube", title: "React 19 Actions Deep Dive" },
      { originalUrl: "https://www.youtube.com/shorts/5e_0B_5b6U0", platform: "youtube-shorts", title: "CSS Subgrid in 60s" },
      { originalUrl: "https://www.youtube.com/watch?v=k5E2AV_1_bQ", platform: "youtube", title: "Next.js Production Performance" },
    ];

    proceedToAnalysis(sampleUrls, "YouTube Account Sync");
  };

  const proceedToAnalysis = (parsed: ParsedImportCandidate[], sourceTitle: string) => {
    setCandidates(parsed);
    // Pass selectedPlatform to strictly validate that candidates match selected source (YouTube or Instagram)
    const analysis = ImportJobService.analyzeCandidates(parsed, items, selectedPlatform);
    setAnalysisResult(analysis);
    setStep("pre_import_analysis");
  };

  // ---------------------------------------------------------------------------
  // Job Execution Handlers
  // ---------------------------------------------------------------------------

  const handleStartImport = async (options: ImportJobOptions) => {
    if (!analysisResult) return;

    const sourceName =
      selectedMethod === "file_export"
        ? `${selectedPlatform === "youtube" ? "Google Takeout" : selectedPlatform === "instagram" ? "Instagram Export" : "Export / Bookmarks"}`
        : selectedMethod === "oauth"
        ? `${selectedPlatform.toUpperCase()} Account Sync`
        : "Pasted URLs";

    const job = ImportJobService.createJob({
      userId,
      platform: selectedPlatform,
      sourceType: selectedMethod,
      sourceName,
      items: analysisResult.candidateItems,
      options,
    });

    setActiveJob(job);
    setStep("live_progress");

    try {
      await ImportJobService.startJob(job.id);
    } catch (err: any) {
      addToast("Import Interrupted", err.message || "An unexpected error occurred.", "error");
    }
  };

  const handlePause = () => {
    if (activeJob) {
      ImportJobService.pauseJob(activeJob.id);
      addToast("Import Paused", "Job execution paused. You can resume anytime.", "info");
    }
  };

  const handleResume = () => {
    if (activeJob) {
      ImportJobService.resumeJob(activeJob.id);
      addToast("Import Resumed", "Continuing background processing.", "info");
    }
  };

  const handleCancel = () => {
    if (activeJob) {
      ImportJobService.cancelJob(activeJob.id);
      ImportJobService.clearActiveJob(userId);
      setActiveJob(null);
      setStep("platform_selection");
      addToast("Import Cancelled", "Import job was stopped.", "warning");
    }
  };

  const handleRetryFailed = async () => {
    if (!currentReport) return;
    setIsRetrying(true);
    try {
      const updatedReport = await ImportJobService.retryFailedItems(currentReport.jobId);
      setCurrentReport(updatedReport);
      setHistoricalReports(ImportJobService.getReports(userId));
      addToast("Retried Failed Items", "Re-processing completed.", "success");
    } catch (err: any) {
      addToast("Retry Failed", err.message, "error");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSelectHistoricalReport = (report: ImportReport) => {
    setCurrentReport(report);
    setStep("report_view");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page Title & Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            {step !== "platform_selection" && step !== "live_progress" && (
              <button
                type="button"
                onClick={() => {
                  if (step === "collection_mapping") {
                    setStep("source_selection");
                  } else if (step === "pre_import_analysis" && instagramAnalysis) {
                    setStep("collection_mapping");
                  } else {
                    setStep("platform_selection");
                  }
                }}
                className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Back to Previous Step"
              >
                <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
              <UploadCloud className="w-6 h-6 text-emerald-500" />
              Bulk Import
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Import hundreds of saves from files, browser bookmarks, exports, or URL lists with grounded AI enrichment, rate-limit backoff, and persistent reporting.
          </p>
        </div>

        {/* Step Indicator Badges */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-semibold overflow-x-auto no-scrollbar pb-1 sm:pb-0 shrink-0 w-full md:w-auto">
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg transition-all",
              step === "platform_selection"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
            )}
          >
            1. Platform
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">→</span>
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg transition-all",
              step === "source_selection" || step === "collection_mapping"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
            )}
          >
            2. Source
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">→</span>
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg transition-all",
              step === "pre_import_analysis"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
            )}
          >
            3. Analysis
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">→</span>
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg transition-all",
              step === "live_progress" || step === "report_view"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
            )}
          >
            4. Execution &amp; Report
          </span>
        </div>
      </div>

      {/* Step 1: Platform Selection */}
      {step === "platform_selection" && (
        <div className="space-y-8">
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                Select Supported Platform
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Bulk import is exclusively enabled for <strong>YouTube &amp; YouTube Shorts</strong> and <strong>Instagram &amp; Instagram Reels</strong>.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
              <PlatformCard
                platform="youtube"
                isSelected={selectedPlatform === "youtube"}
                onSelect={handlePlatformSelect}
              />
              <PlatformCard
                platform="instagram"
                isSelected={selectedPlatform === "instagram"}
                onSelect={handlePlatformSelect}
              />
            </div>
          </div>

          {/* Historical Import Reports Drawer */}
          <HistoricalReportsList
            reports={historicalReports}
            onSelectReport={handleSelectHistoricalReport}
          />
        </div>
      )}

      {/* Step 2: Source Selection & File Upload */}
      {step === "source_selection" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 capitalize">
              {selectedPlatform === "website" ? "Universal Web & Bookmarks" : `${selectedPlatform} Import Sources`}
            </h2>
            <button
              type="button"
              onClick={() => setStep("platform_selection")}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              Change Platform
            </button>
          </div>

          <ImportSourceSelector
            platform={selectedPlatform}
            selectedMethod={selectedMethod}
            onSelectMethod={setSelectedMethod}
            onFileLoaded={handleFileLoaded}
            onArchiveLoaded={handleArchiveLoaded}
            onMultipleFilesLoaded={handleMultipleFilesLoaded}
            onUrlsSubmitted={handleUrlsSubmitted}
            isConnectingOAuth={false}
            onConnectOAuth={handleOAuthConnect}
            isConnectedOAuth={false}
            onOpenExportGuide={() => setIsGuideOpen(true)}
          />
        </div>
      )}

      {/* Step 2b: Instagram Collection Discovery & Destination Mapping */}
      {step === "collection_mapping" && instagramAnalysis && (
        <InstagramCollectionMapper
          discoveredCollections={instagramAnalysis.collections}
          uncollectedCount={instagramAnalysis.uncollectedCount}
          allCandidates={instagramAnalysis.candidates}
          existingCollections={collections}
          onCreateCollection={handleCreateCollection}
          onConfirm={handleCollectionMappingConfirmed}
          onCancel={() => setStep("source_selection")}
        />
      )}

      {/* Step 3: Pre-Import Analysis */}
      {step === "pre_import_analysis" && analysisResult && (
        <PreImportAnalysis
          platform={selectedPlatform}
          accountName={user?.name || "Connected User"}
          sourceName={
            selectedMethod === "file_export"
              ? `${selectedPlatform === "website" ? "Bookmarks / File" : selectedPlatform} Export File`
              : selectedMethod === "oauth"
              ? `${selectedPlatform} Account Sync`
              : "URL Batch List"
          }
          totalDiscovered={analysisResult.total}
          readyCount={analysisResult.ready}
          alreadySavedCount={analysisResult.alreadySaved}
          batchDuplicateCount={analysisResult.batchDuplicates}
          unsupportedCount={analysisResult.unsupported}
          duplicateCount={analysisResult.duplicates}
          newCount={analysisResult.newItems}
          sampleItems={analysisResult.candidateItems}
          collections={collections}
          onConfirm={handleStartImport}
          onCancel={() => {
            if (instagramAnalysis && instagramAnalysis.collections.length > 0) {
              setStep("collection_mapping");
            } else {
              setStep("source_selection");
            }
          }}
        />
      )}

      {/* Step 4: Live Progress Tracker */}
      {step === "live_progress" && activeJob && (
        <LiveProgressTracker
          job={activeJob}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
        />
      )}

      {/* Step 5: Persistent Import Report */}
      {step === "report_view" && currentReport && (
        <ImportReportView
          report={currentReport}
          onRetryFailed={handleRetryFailed}
          onNewImport={() => {
            ImportJobService.clearActiveJob(userId);
            setActiveJob(null);
            setStep("platform_selection");
          }}
          isRetrying={isRetrying}
        />
      )}

      {/* Instagram Official Export Guide Modal */}
      <InstagramExportGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
