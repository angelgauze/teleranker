"use client";

import { useEffect, useState } from "react";
import { COMPARE_TRAY_ID } from "./compare-picker";

/**
 * Round arrow button in the bottom-right corner. Appears after about one
 * screen of scrolling and sits above the compare tray when the tray is open.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [bottom, setBottom] = useState(16);

  useEffect(() => {
    const update = () => {
      setVisible(window.scrollY > window.innerHeight);
      const tray = document.getElementById(COMPARE_TRAY_ID);
      setBottom((tray?.offsetHeight ?? 0) + 16);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // The tray opens and closes without a scroll, so watch the page for it too.
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      style={{ bottom }}
      className="fixed right-4 z-30 flex size-11 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-900 shadow-md hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
