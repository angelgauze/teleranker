"use client";

import { useEffect, useState } from "react";
import { COMPARE_TRAY_ID } from "./compare-picker";

/**
 * Round arrow button in the bottom-right corner. Appears after about one
 * screen of scrolling, and hides while the compare bar is open so it never
 * covers the Compare button.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const bottom = 16;

  useEffect(() => {
    const update = () => {
      const trayOpen = document.getElementById(COMPARE_TRAY_ID) !== null;
      setVisible(window.scrollY > window.innerHeight && !trayOpen);
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
      className="fixed right-4 z-30 flex size-11 items-center justify-center rounded-full border border-line-strong bg-raised text-fg hover:bg-selected sm:shadow-[0_8px_24px_rgb(0_0_0/0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6"
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
