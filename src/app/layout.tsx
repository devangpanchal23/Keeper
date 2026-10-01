import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RecallProvider } from "@/context/RecallContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recall — AI-Powered Universal Bookmark & Knowledge Platform",
  description:
    "Save anything from Instagram, YouTube, Reddit, LinkedIn, X, TikTok, Pinterest, and blogs. AI summarizes, categorizes, tags, and makes everything searchable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Caveat:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('recall_user_v1') || localStorage.getItem('recall_user');
                  var theme = 'dark';
                  if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed && parsed.settings && parsed.settings.theme) {
                      theme = parsed.settings.theme;
                    }
                  }
                  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  var root = document.documentElement;
                  if (isDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.style.colorScheme = 'dark';
                  } else {
                    root.classList.remove('dark');
                    root.classList.add('light');
                    root.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full font-sans bg-[#f8fafc] dark:bg-[#090a0f] text-zinc-900 dark:text-zinc-100 flex flex-col`}
      >
        <RecallProvider>{children}</RecallProvider>
      </body>
    </html>
  );
}
