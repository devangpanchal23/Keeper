"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "@/components/modals/CommandPalette";
import { AddContentModal } from "@/components/modals/AddContentModal";
import { CollectionModal } from "@/components/modals/CollectionModal";
import { QuickNoteModal } from "@/components/modals/QuickNoteModal";
import { ToastContainer } from "@/components/common/ToastContainer";
import { useRecall } from "@/context/RecallContext";
import { Zap, Loader2 } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const router = useRouter();
  const { isAuthenticated, authLoading } = useRecall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Protected route guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  // Loading state: Never flash dummy user data
  if (authLoading) {
    return (
      <div className="flex h-screen h-[100dvh] w-full max-w-full overflow-hidden items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 animate-pulse">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span>Verifying workspace session...</span>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, do not render private content while redirecting
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen h-[100dvh] w-full max-w-full overflow-hidden bg-zinc-50 dark:bg-[#090a0f] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-white dark:bg-zinc-950 shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>

        {/* Mobile Navigation bar */}
        <MobileNav />
      </div>

      {/* Global Modals & Notifications */}
      <CommandPalette />
      <AddContentModal />
      <CollectionModal />
      <QuickNoteModal />
      <ToastContainer />
    </div>
  );
};
