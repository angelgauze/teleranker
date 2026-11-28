"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { compareHref, MAX_PICKS } from "@/lib/compare/selection";
import {
  clearComparePicks,
  showCompareNotice,
  toggleComparePick,
  useCompareNotice,
  useComparePicks,
} from "./compare-store";

/**
 * A row's compare checkbox. It stays a normal form field (name="id"), so the
 * listing's "Compare selected" form still works without JavaScript; with
 * JavaScript it reflects the remembered picks instead.
 */
export function CompareCheckbox({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const picks = useComparePicks();
  const checked = picks.some((pick) => pick.id === id);

  return (
    <input
      type="checkbox"
      name="id"
      value={id}
      checked={checked}
      onChange={() => toggleComparePick({ id, name })}
      aria-label={`Select ${name} for comparison`}
      className={className}
    />
  );
}

/**
 * The listing's "Compare selected" button. With JavaScript it opens the
 * remembered picks (from any filter); without it, the form submits the boxes
 * ticked on this page.
 */
export function CompareSubmitButton({ className }: { className?: string }) {
  const picks = useComparePicks();
  const router = useRouter();

  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        if (picks.length === MAX_PICKS) router.push(compareHref(picks));
        else showCompareNotice("Pick two promos to compare.");
      }}
    >
      Compare selected ({picks.length} of {MAX_PICKS})
    </button>
  );
}

/** The tray's element id, so the back-to-top button can sit above it. */
export const COMPARE_TRAY_ID = "compare-tray";

/** Bar pinned to the bottom of the screen while promos are picked. */
export function CompareTray() {
  const picks = useComparePicks();
  const notice = useCompareNotice();
  const trayRef = useRef<HTMLElement>(null);
  const open = picks.length > 0;

  // Pads the page by the bar's height plus its gap, so the end of the page (and
  // the footer) never hides behind it.
  useEffect(() => {
    const tray = trayRef.current;
    if (!open || !tray) return;
    const pad = () => {
      document.body.style.paddingBottom = `${tray.offsetHeight + 32}px`;
    };
    pad();
    const observer = new ResizeObserver(pad);
    observer.observe(tray);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [open]);

  if (!open) return null;
  const ready = picks.length === MAX_PICKS;

  return (
    <section
      ref={trayRef}
      id={COMPARE_TRAY_ID}
      aria-label="Promos to compare"
      className="fixed inset-x-3 bottom-4 z-20 mx-auto max-w-[44rem] rounded-xl border border-line-strong bg-raised text-fg sm:inset-x-6 sm:bg-raised/95 sm:shadow-[0_20px_50px_rgb(0_0_0/0.6)] sm:backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 pr-2.5 pl-4">
        <div className="min-w-0 flex-1 basis-full min-[520px]:basis-0" aria-live="polite">
          {notice ? (
            <p className="text-sm font-medium">{notice}</p>
          ) : (
            <>
              <p className="text-xs text-fg-4 tabular-nums">
                {picks.length} of {MAX_PICKS} picked
              </p>
              <ol className="text-sm leading-snug font-medium">
                {picks.map((pick) => (
                  <li key={pick.id}>{pick.name}</li>
                ))}
                {ready ? null : <li className="font-normal text-fg-3">Pick one more</li>}
              </ol>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={clearComparePicks}
          className="ml-auto h-11 shrink-0 rounded-lg px-3 text-sm text-fg-3 hover:bg-selected hover:text-fg focus-visible:outline-2 min-[520px]:ml-0"
        >
          Clear
        </button>
        {ready ? (
          <Link
            href={compareHref(picks)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-fg px-4 text-sm font-[590] text-canvas hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Compare
          </Link>
        ) : (
          <button
            type="button"
            aria-disabled="true"
            onClick={() => showCompareNotice("Pick one more promo to compare.")}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-4 text-sm font-medium text-fg-4 focus-visible:outline-2"
          >
            Compare
          </button>
        )}
      </div>
    </section>
  );
}
