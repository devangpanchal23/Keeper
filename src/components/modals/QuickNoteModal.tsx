"use client";

import React, { useState, useEffect } from "react";
import { useRecall } from "@/context/RecallContext";
import { X, StickyNote, Check } from "lucide-react";

export const QuickNoteModal: React.FC = () => {
  const {
    isQuickNoteModalOpen,
    closeQuickNoteModal,
    quickNoteItem,
    updateItem,
  } = useRecall();

  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (quickNoteItem) {
      setNotes(quickNoteItem.personalNotes || "");
    }
  }, [quickNoteItem, isQuickNoteModalOpen]);

  if (!isQuickNoteModalOpen || !quickNoteItem) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateItem(quickNoteItem.id, { personalNotes: notes });
    closeQuickNoteModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeQuickNoteModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Personal Note
            </h3>
          </div>
          <button
            onClick={closeQuickNoteModal}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <p className="text-xs text-zinc-500 mb-2 line-clamp-1 font-medium">
              &quot;{quickNoteItem.title}&quot;
            </p>
            <textarea
              rows={5}
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jot down personal takeaways, next actions, code snippets, or thoughts..."
              className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeQuickNoteModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
            >
              <Check className="w-3.5 h-3.5" />
              Save Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
