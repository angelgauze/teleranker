"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { COMPARE_TRAY_ID } from "./compare-picker";

/** Where focus goes when the pop-up closes: the tray's Compare button, if it is still there. */
function focusCompareButton() {
  const tray = document.getElementById(COMPARE_TRAY_ID);
  tray?.querySelector<HTMLElement>('a[href^="/compare"], [aria-disabled="true"]')?.focus();
}

/** Modal dialog (a sheet on phones). Closing goes back one step, so Back closes it too. */
export function CompareDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // A reopened pop-up starts at the top, not where the last one was left.
    dialog.querySelector("[data-compare-scroll]")?.scrollTo({ top: 0 });
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
      if (dialog.open) dialog.close();
      requestAnimationFrame(focusCompareButton);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="compare-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        router.back();
      }}
      onClick={(event) => {
        // A click on the dimmed area outside the panel (desktop only; the sheet fills the phone).
        if (event.target === event.currentTarget && window.matchMedia("(min-width: 768px)").matches) {
          router.back();
        }
      }}
      className="m-auto max-h-[min(88dvh,64rem)] w-[min(780px,calc(100vw-3rem))] max-w-none flex-col overflow-hidden rounded-[14px] border border-line-strong bg-panel p-0 text-fg tabular-nums shadow-[0_24px_80px_rgb(0_0_0/0.6)] backdrop:bg-[rgb(5_6_8/0.7)] open:flex max-md:mt-auto max-md:mb-0 max-md:h-[calc(100dvh-0.75rem)] max-md:max-h-none max-md:w-full max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:shadow-none"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-1 pr-1 pl-4 md:pr-2 md:pl-7">
          <h2
            id="compare-dialog-title"
            className="text-[17px] leading-tight font-[590] tracking-[-0.01em] text-fg"
          >
            Compare promos
          </h2>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close comparison"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-3 hover:bg-selected hover:text-fg focus-visible:outline-2"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      {/* Padding inside the scroller, so pinned names meet its top edge. */}
      <div data-compare-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pt-4 sm:px-7 md:pt-5">{children}</div>
      </div>
    </dialog>
  );
}
