"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { Lead } from "@/lib/compare/emphasis";
import type { PromoStatus } from "@/lib/schema/promo";
import { STATUS_LABELS } from "@/lib/ui/format";
import { toggleComparePick } from "./compare-store";
import { BAND, GRID, LABEL_CELL, ROW, TABLE_BLEED, TAG, VALUE_CELL, valueTone } from "./compare-table";
import { ProviderBadge } from "./provider-badge";

export interface FieldRow {
  label: string;
  values: [React.ReactNode, React.ReactNode];
  /** Both promos show the same value; hidden under "Differences". */
  same: boolean;
  /** The promo that is ahead on this field; the row is banded and the value bold. */
  lead: Lead | null;
}

export interface ColumnHead {
  id: string;
  name: string;
  providerName: string;
  price: string;
  status: PromoStatus;
}

type View = "all" | "diff";

const WIDE = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Wide screens open on all fields, phones on the differences; unknown until the browser says. */
function useWide(): boolean | null {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

function StatusLabel({ status }: { status: PromoStatus }) {
  if (status === "ACTIVE") return null;
  return (
    <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-2">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        {status === "OUTDATED" ? <path d="M12 7v5l3 2" /> : <path d="m9 9 6 6M15 9l-6 6" />}
      </svg>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Remove one promo: the pop-up closes and the other promo stays picked on the listing. */
function RemoveButton({ head }: { head: ColumnHead }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        toggleComparePick({ id: head.id, name: head.name });
        router.back();
      }}
      aria-label={`Remove ${head.name} from the comparison`}
      title="Remove"
      // A 44px tap area around a small mark, pulled into the corner.
      className="-mt-3 -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-4 hover:bg-selected hover:text-fg focus-visible:outline-2 md:-mr-3.5"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

/** All fields / Differences, as a two-part switch. */
function ViewSwitch({ view, onChange }: { view: View | null; onChange: (view: View) => void }) {
  const tone = (on: boolean) => (on ? "bg-selected text-fg" : "text-fg-3 hover:text-fg");
  const button = "h-10 rounded-[5px] px-3 text-[13px] font-medium focus-visible:outline-2 sm:h-8";
  return (
    <div
      role="group"
      aria-label="Rows to show"
      className="grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-canvas p-[3px] sm:w-[15rem]"
    >
      <button type="button" aria-pressed={view === "all"} onClick={() => onChange("all")} className={`${button} ${tone(view === "all")}`}>
        All fields
      </button>
      <button type="button" aria-pressed={view === "diff"} onClick={() => onChange("diff")} className={`${button} ${tone(view === "diff")}`}>
        Differences
      </button>
    </div>
  );
}

/** The comparison table: labels left, one column per promo, names pinned on top. */
export function CompareFields({
  heads,
  rows,
  footer,
  tools,
  removable,
  surface,
}: {
  heads: [ColumnHead, ColumnHead];
  rows: FieldRow[];
  /** Rows that are always shown (the source links). */
  footer: FieldRow[];
  /** Shown beside the switch (the 4G-only phone box). */
  tools: React.ReactNode;
  removable: boolean;
  /** The background behind the pinned names. */
  surface: "panel" | "canvas";
}) {
  const wide = useWide();
  const [chosen, setChosen] = useState<View | null>(null);
  // Before the browser reports its width, CSS hides matching rows on phones only.
  const view: View | null = chosen ?? (wide === null ? null : wide ? "all" : "diff");
  const sameCount = rows.filter((row) => row.same).length;
  const allSame = sameCount === rows.length;
  const hideSame = view === "diff" ? "hidden" : view === null ? "max-md:hidden" : "";
  const onlyPhone = view === null ? "md:hidden" : "";

  return (
    <section aria-label="Field-by-field comparison">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <ViewSwitch view={view} onChange={setChosen} />
        {tools}
      </div>
      <p aria-live="polite" className="sr-only">
        {chosen === "diff"
          ? `Showing differences only. ${sameCount} matching fields hidden.`
          : chosen === "all"
            ? "Showing all fields."
            : ""}
      </p>

      <div role="table" aria-label={`${heads[0].name} compared with ${heads[1].name}`} className={`mt-2 ${TABLE_BLEED}`}>
        <div
          role="rowgroup"
          // In the pop-up the names pin to its own top; on the full page, under the site header.
          className={`sticky z-10 border-y border-line short:static ${surface === "panel" ? "top-0 bg-panel" : "top-14 bg-canvas sm:top-15"}`}
        >
          <div role="row" className={GRID}>
            <div role="columnheader" className="flex items-end py-2.5 pr-2 pl-4 text-[11px] text-fg-4 sm:pl-0 md:py-3.5 md:text-xs">
              Field
            </div>
            {heads.map((head) => (
              <div key={head.id} role="columnheader" className="min-w-0 border-l border-line px-2.5 py-2.5 md:px-4 md:py-3.5">
                <div className="flex items-start justify-between gap-1">
                  <ProviderBadge name={head.providerName} />
                  {removable ? <RemoveButton head={head} /> : null}
                </div>
                <p className={`text-[13px] leading-tight font-[590] break-words text-fg md:text-[15px] ${removable ? "-mt-3" : "mt-1.5 md:mt-2"}`}>
                  {head.name}
                </p>
                <p className="mt-1 text-lg font-[590] tracking-[-0.02em] text-fg md:mt-1.5 md:text-2xl md:tracking-[-0.03em]">
                  {head.price}
                </p>
                <StatusLabel status={head.status} />
              </div>
            ))}
          </div>
        </div>

        <div role="rowgroup">
          {view !== "all" && allSame ? (
            <p className={`border-b border-line-soft px-4 py-3 text-sm text-fg-2 sm:px-0 ${onlyPhone}`}>
              These two promos match on every field.
            </p>
          ) : null}
          {[...rows, ...footer].map((row) => {
            const kept = footer.includes(row);
            return (
              <div
                key={row.label}
                role="row"
                className={`${ROW} ${row.lead ? BAND : ""} ${row.same && !kept ? hideSame : ""}`}
              >
                <div role="rowheader" className={LABEL_CELL}>
                  {row.label}
                </div>
                {row.values.map((value, index) => {
                  const leads = row.lead?.index === index;
                  return (
                    <div key={index} role="cell" className={`${VALUE_CELL} ${valueTone(row.same, leads)}`}>
                      <span className="sr-only">{heads[index].name}: </span>
                      {value}
                      {leads && row.lead?.tag ? <span className={TAG}>{row.lead.tag}</span> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {sameCount > 0 && view !== "all" && !allSame ? (
        <p className={`text-[13px] text-fg-3 ${onlyPhone}`}>
          {sameCount} matching {sameCount === 1 ? "field" : "fields"} hidden ·{" "}
          <button
            type="button"
            onClick={() => setChosen("all")}
            className="inline-flex min-h-11 items-center text-fg-2 underline underline-offset-4 hover:text-fg"
          >
            Show all
          </button>
        </p>
      ) : null}
    </section>
  );
}
