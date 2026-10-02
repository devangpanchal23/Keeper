import React from "react";
import { Platform } from "@/types";
import { Globe, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom resilient SVG brand icons to avoid third-party library deprecations
export const YoutubeIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const YoutubeShortsIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.77 10.32l-1.2-.5a5.5 5.5 0 0 0 .53-2.32c0-2.5-2.02-4.5-4.5-4.5a4.48 4.48 0 0 0-3.7 1.93l-4.5 7.8a4.5 4.5 0 0 0 3.9 6.77c.8 0 1.57-.22 2.23-.62l1.2.5a5.5 5.5 0 0 0-.53 2.32c0 2.5 2.02 4.5 4.5 4.5 1.54 0 2.92-.78 3.7-1.93l4.5-7.8a4.5 4.5 0 0 0-3.9-6.77c-.8 0-1.57.22-2.23.62zm-7.77 5.18v-7l6 3.5-6 3.5z" />
  </svg>
);

export const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

const XTwitterIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const PinterestIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 0a12 12 0 0 0-4.37 23.17c-.07-.94-.13-2.39.03-3.42l1.03-4.36s-.26-.52-.26-1.3c0-1.22.71-2.13 1.59-2.13.75 0 1.11.56 1.11 1.24 0 .76-.48 1.89-.73 2.94-.21.88.44 1.6 1.3 1.6 1.57 0 2.77-1.65 2.77-4.04 0-2.11-1.52-3.59-3.69-3.59-2.51 0-3.99 1.89-3.99 3.84 0 .76.29 1.58.66 2.02.07.09.08.17.06.26l-.25 1.02c-.04.16-.13.2-.3.12-1.12-.52-1.82-2.16-1.82-3.48 0-2.83 2.06-5.43 5.94-5.43 3.12 0 5.54 2.22 5.54 5.19 0 3.1-1.95 5.59-4.66 5.59-.91 0-1.77-.47-2.06-1.03l-.56 2.14c-.2 1.79-.75 2.01-1.12 2.61A12 12 0 1 0 12 0z" />
  </svg>
);

const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const ThreadsIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.186 24h-.007c-3.581-.026-6.333-1.205-8.18-3.504C2.274 18.324 1.5 15.309 1.5 11.974c0-3.376.812-6.384 2.483-8.697C5.83 1.01 8.62.016 12.27 0c3.784.017 6.643 1.084 8.5 3.172 1.745 1.962 2.664 4.737 2.73 8.247h-4.088c-.085-2.48-.68-4.24-1.77-5.23-1.125-1.02-2.903-1.545-5.357-1.558-2.607.012-4.526.732-5.706 2.14-1.24 1.48-1.895 3.655-1.895 6.275 0 2.76.657 5.034 1.902 6.578 1.196 1.482 3.12 2.247 5.719 2.276 2.378-.027 4.148-.567 5.263-1.606.947-.883 1.542-2.185 1.769-3.87-1.077.585-2.296.892-3.623.892-4.103 0-6.425-2.126-6.425-5.908 0-3.69 2.443-6.19 6.223-6.19 3.96 0 6.307 2.64 6.307 6.947 0 2.285-.436 4.343-1.298 6.117-1.534 3.16-4.488 4.745-8.78 4.766zm.052-12.793c-1.748 0-2.825.992-2.825 2.593 0 1.636 1.076 2.647 2.825 2.647 1.442 0 2.533-.67 3.076-1.77-.282-1.996-1.428-3.47-3.076-3.47z" />
  </svg>
);

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
  showIconOnly?: boolean;
}

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
  platform,
  className,
  showIconOnly = false,
}) => {
  const getPlatformConfig = () => {
    switch (platform) {
      case "youtube":
        return {
          label: "YouTube",
          icon: <YoutubeIcon className="w-3.5 h-3.5" />,
          color: "bg-red-500/10 text-red-500 border-red-500/20",
        };
      case "youtube-shorts":
        return {
          label: "YT Shorts",
          icon: <YoutubeShortsIcon className="w-3.5 h-3.5" />,
          color: "bg-red-600/10 text-red-500 border-red-500/20",
        };
      case "instagram":
        return {
          label: "Instagram",
          icon: <InstagramIcon className="w-3.5 h-3.5" />,
          color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
        };
      case "reddit":
        return {
          label: "Reddit",
          icon: <span className="font-bold text-xs leading-none">r/</span>,
          color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        };
      case "linkedin":
        return {
          label: "LinkedIn",
          icon: <LinkedinIcon className="w-3.5 h-3.5" />,
          color: "bg-blue-600/10 text-blue-500 border-blue-500/20",
        };
      case "x":
      case "twitter":
        return {
          label: "X",
          icon: <XTwitterIcon className="w-3 h-3" />,
          color: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20",
        };
      case "tiktok":
        return {
          label: "TikTok",
          icon: <TikTokIcon className="w-3 h-3" />,
          color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
        };
      case "pinterest":
        return {
          label: "Pinterest",
          icon: <PinterestIcon className="w-3.5 h-3.5" />,
          color: "bg-red-700/10 text-red-600 dark:text-red-400 border-red-700/20",
        };
      case "facebook":
        return {
          label: "Facebook",
          icon: <FacebookIcon className="w-3.5 h-3.5" />,
          color: "bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-600/20",
        };
      case "threads":
        return {
          label: "Threads",
          icon: <ThreadsIcon className="w-3.5 h-3.5" />,
          color: "bg-zinc-600/10 text-zinc-700 dark:text-zinc-300 border-zinc-600/20",
        };
      case "github":
        return {
          label: "GitHub",
          icon: <GithubIcon className="w-3.5 h-3.5" />,
          color: "bg-neutral-500/10 text-neutral-800 dark:text-neutral-200 border-neutral-500/20",
        };
      case "blog":
        return {
          label: "Blog",
          icon: <FileText className="w-3.5 h-3.5" />,
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
      case "website":
      default:
        return {
          label: "Website",
          icon: <Globe className="w-3.5 h-3.5" />,
          color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        };
    }
  };

  const config = getPlatformConfig();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-colors",
        config.color,
        className
      )}
      title={config.label}
    >
      {config.icon}
      {!showIconOnly && <span>{config.label}</span>}
    </span>
  );
};
