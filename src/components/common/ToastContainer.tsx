"use client";

import React from "react";
import { useRecall } from "@/context/RecallContext";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useRecall();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case "success":
              return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
            case "error":
              return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
            case "warning":
              return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
            case "info":
            default:
              return <Info className="w-5 h-5 text-indigo-400 shrink-0" />;
          }
        };

        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-5",
              "bg-zinc-900/95 text-zinc-100 border-zinc-700/80 backdrop-blur-md"
            )}
          >
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-semibold tracking-tight leading-snug">{toast.title}</h5>
              {toast.description && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 -mr-1 -mt-1 rounded-md"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
