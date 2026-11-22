"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Bar pinned to the bottom of the screen while promos are picked. */
export function CompareTray() {
  const picks = useComparePicks();
  const notice = useCompareNotice();
  if (picks.length === 0) return null;

  const ready = picks.length === MAX_PICKS;
  const names = picks.map((pick) => pick.name).join(", ");

  return (
    <>
      {/* Keeps the end of the page from hiding behind the bar. */}
      <div aria-hidden="true" className="h-28 sm:h-20" />
      <section
        aria-label="Promos to compare"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 text-sm" aria-live="polite">
            {notice ? (
              <p className="font-medium text-amber-800 dark:text-amber-300">{notice}</p>
            ) : (
              <p className="truncate">
                <span className="font-semibold">
                  {picks.length} of {MAX_PICKS}:
                </span>{" "}
                {names}
                {ready ? null : (
                  <span className="text-zinc-600 dark:text-zinc-400"> · pick 1 more</span>
                )}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearComparePicks}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
            {ready ? (
              <Link
                href={compareHref(picks)}
                className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Compare <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                type="button"
                aria-disabled="true"
                onClick={() => showCompareNotice("Pick one more promo to compare.")}
                className="rounded border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
              >
                Compare <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
