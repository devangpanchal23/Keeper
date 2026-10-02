"use client";

import React, { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

export function ThemeScript() {
  const isInserted = useRef(false);

  useServerInsertedHTML(() => {
    if (isInserted.current) return null;
    isInserted.current = true;

    return (
      <script
        id="recall-theme-init"
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
    );
  });

  return null;
}
