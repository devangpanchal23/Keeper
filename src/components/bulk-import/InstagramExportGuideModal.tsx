"use client";

import React from "react";
import {
  X,
  DownloadCloud,
  FileCode,
  ShieldCheck,
  ExternalLink,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface InstagramExportGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstagramExportGuideModal: React.FC<InstagramExportGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-modal-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-pink-500/20">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="guide-modal-title"
                className="text-base font-bold text-zinc-900 dark:text-zinc-100"
              >
                How to Export Your Saved Instagram Content
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official Meta Accounts Center Data Export (GDPR / Privacy Download)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Privacy & Zero-Password Notice */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-emerald-950 dark:text-emerald-200">
                100% Client-Side Privacy & Zero Credentials Stored
              </p>
              <p className="text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                Keeper never asks for your Instagram password, session cookies, or 2FA codes.
                Using Meta&apos;s official export guarantees your account stays completely secure
                while preserving all your saved posts and collections.
              </p>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Step-by-Step Export Instructions
            </h4>

            {/* Step 1 */}
            <div className="flex gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Open Meta Accounts Center
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Go to{" "}
                  <a
                    href="https://accountscenter.instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 underline font-medium inline-flex items-center gap-1"
                  >
                    accountscenter.instagram.com
                    <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  or in the Instagram app go to <strong>Settings → Accounts Center</strong>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Locate Your Information and Permissions
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Select <strong>Your information and permissions</strong>, then choose{" "}
                  <strong>Export your information</strong> (or <em>Download your information</em>).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Select &quot;Saved&quot; Information Only
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Select your Instagram profile. When asked <em>How much information?</em>, choose{" "}
                  <strong>Some of your information</strong> and check only <strong>Saved</strong>{" "}
                  (under Activity across Instagram). This makes the export quick (usually ready in a few minutes).
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                4
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Choose JSON Format
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Destination: <strong>Download to device</strong>.<br />
                  Format: Choose <span className="font-semibold text-indigo-600 dark:text-indigo-400">JSON</span> (recommended for instant automated parsing).<br />
                  Date Range: <strong>All time</strong>.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                5
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Download Archive &amp; Upload to Keeper
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Once Meta notifies you the download is ready, download the file. You can upload the entire{" "}
                  <strong>.zip</strong> archive directly into Keeper, or unzip it and select the{" "}
                  <strong>saved_posts.json</strong> and <strong>saved_collections.json</strong> files!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-zinc-400" /> Supports .json files &amp; official Meta .zip archives
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            Got It, Ready to Upload
          </button>
        </div>
      </div>
    </div>
  );
};
