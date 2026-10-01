"use client";

import React, { useState, useEffect } from "react";
import { useRecall } from "@/context/RecallContext";
import { X, Folder, Trash2, Check } from "lucide-react";

const COLOR_PALETTE = [
  "#6366f1", // Indigo
  "#06b6d4", // Cyan
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Rose
  "#3b82f6", // Blue
  "#84cc16", // Lime
  "#14b8a6", // Teal
];

export const CollectionModal: React.FC = () => {
  const {
    isCollectionModalOpen,
    closeCollectionModal,
    editingCollection,
    createCollection,
    updateCollection,
    deleteCollection,
  } = useRecall();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [icon, setIcon] = useState("Folder");

  useEffect(() => {
    if (editingCollection) {
      setName(editingCollection.name);
      setDescription(editingCollection.description || "");
      setColor(editingCollection.color || COLOR_PALETTE[0]);
      setIcon(editingCollection.icon || "Folder");
    } else {
      setName("");
      setDescription("");
      setColor(COLOR_PALETTE[0]);
      setIcon("Folder");
    }
  }, [editingCollection, isCollectionModalOpen]);

  if (!isCollectionModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCollection) {
      updateCollection(editingCollection.id, {
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
      });
    } else {
      createCollection({
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
      });
    }

    closeCollectionModal();
  };

  const handleDelete = () => {
    if (!editingCollection) return;
    if (confirm(`Are you sure you want to delete collection "${editingCollection.name}"?`)) {
      deleteCollection(editingCollection.id);
      closeCollectionModal();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeCollectionModal}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              <Folder className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {editingCollection ? "Edit Collection" : "New Collection"}
            </h3>
          </div>
          <button
            onClick={closeCollectionModal}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Collection Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Next.js Architecture, Travel Hacks"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of items belong in this collection?"
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Color Theme
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((hex) => (
                <button
                  type="button"
                  key={hex}
                  onClick={() => setColor(hex)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                  style={{ backgroundColor: hex }}
                >
                  {color === hex && <Check className="w-4 h-4 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {editingCollection ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeCollectionModal}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20"
              >
                {editingCollection ? "Save Changes" : "Create Collection"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
