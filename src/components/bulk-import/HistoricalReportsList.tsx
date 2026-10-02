"use client";

import React from "react";
import { ImportReport } from "@/types";
import { PlatformBadge } from "../common/PlatformBadge";
import { Clock, CheckCircle2, ArrowRight, FileText } from "lucide-react";

interface HistoricalReportsListProps {
  reports: ImportReport[];
  onSelectReport: (report: ImportReport) => void;
}

export const HistoricalReportsList: React.FC<HistoricalReportsListProps> = ({
  reports,
  onSelectReport,
}) => {
  if (reports.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-center space-y-2">
        <FileText className="w-8 h-8 text-zinc-400 mx-auto mb-1 opacity-60" />
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No Past Import Reports</h4>
        <p className="text-xs text-zinc-400">
          When you complete an import job, a persistent report map will be archived here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-indigo-500" />
        Historical Import Reports ({reports.length})
      </h3>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white/70 dark:bg-zinc-900/70">
        {reports.map((report) => (
          <div
            key={report.id}
            className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <PlatformBadge platform={report.platform} />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {report.sourceName}
                </span>
                <span className="text-[11px] text-zinc-400">
                  • {new Date(report.completedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {report.summary.imported} imported • {report.summary.duplicates} duplicates • {report.summary.failed} failed ({report.summary.successPercentage}% success)
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectReport(report)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all shrink-0 w-full sm:w-auto"
            >
              <span>View Report</span>
              <ArrowRight className="w-3 h-3 text-indigo-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
