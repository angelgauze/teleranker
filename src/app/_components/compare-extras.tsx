import Form from "next/form";
import { summarizeDifferences, type ComparedPromo, type DifferenceKind } from "@/lib/compare/differences";
import { fourGPhoneSupport, isFourGOnlyPhone } from "@/lib/compare/needs";
import type { PublishedPromo } from "@/lib/db/promos";
import { AutoSubmitCheckbox } from "./auto-submit-checkbox";

/** Compare extras: the differences summary, the 4G phone switch and the link to Plan. */

export type CompareParams = Record<string, string | string[] | undefined>;

export type CompareRow = { label: string; value: (entry: PublishedPromo) => string };

/** Shown first in the comparison when the visitor says their phone is 4G only. */
export const PHONE_ROW: CompareRow = {
  label: "On a 4G-only phone",
  value: ({ promo }) => fourGPhoneSupport(promo.compatibility),
};

const KEPT_KEYS = ["phone", "days", "daily", "budget"] as const;

/** Hidden fields that keep the rest of the address when one form is sent. */
function KeepParams({ ids, params, skip }: { ids: string[]; params: CompareParams; skip: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      {KEPT_KEYS.filter((key) => !skip.includes(key)).map((key) => {
        const raw = params[key];
        const value = Array.isArray(raw) ? raw[0] : raw;
        return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
      })}
    </>
  );
}

const MARKS: Record<DifferenceKind, React.ReactNode> = {
  // ↑ one promo is ahead
  ahead: <path d="M12 19V5M5 12l7-7 7 7" />,
  // ≠ they differ, neither is ahead
  different: <path d="M5 9h14M5 15h14M15 5 9 19" />,
  // = they match
  same: <path d="M5 9h14M5 15h14" />,
  // ? a value is missing
  unknown: <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.01" />,
};

/** The focal point: one line per promo with what it does better, then what matches. */
export function Differences({ a, b }: { a: ComparedPromo; b: ComparedPromo }) {
  return (
    <ul
      aria-label="How they differ"
      className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[13px] leading-normal"
    >
      {summarizeDifferences(a, b).map(({ kind, name, text }) => {
        const strong = kind === "ahead" || kind === "different";
        return (
          <li key={`${kind}-${name ?? text}`} className={`flex gap-2.5 ${strong ? "text-fg-2" : "text-fg-3"}`}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`mt-[3px] size-3.5 shrink-0 ${strong ? "text-fg" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {MARKS[kind]}
            </svg>
            <span>
              {name ? <span className="font-[590] text-fg">{name}: </span> : null}
              {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "My phone is 4G only"; replaces the address in place so Back still closes the comparison. */
export function PhoneSwitch({ ids, params }: { ids: string[]; params: CompareParams }) {
  return (
    // Keyed by the current value: Next.js keeps a closed pop-up alive, and the
    // box must match the address when it is shown again.
    <Form key={isFourGOnlyPhone(params) ? "4g" : "any"} action="/compare" replace scroll={false} className="flex">
      <KeepParams ids={ids} params={params} skip={["phone"]} />
      <AutoSubmitCheckbox
        name="phone"
        value="4g"
        defaultChecked={isFourGOnlyPhone(params)}
        label="My phone is 4G only"
      />
      <noscript>
        <button type="submit" className="ml-2 h-9 rounded-lg border border-line px-3 text-sm text-fg-2">
          Apply
        </button>
      </noscript>
    </Form>
  );
}

/** Plan with this pair, keeping any needs already in the address. */
export function planHrefFor(ids: string[], params: CompareParams): string {
  const query = new URLSearchParams(ids.map((id) => ["id", id]));
  for (const key of KEPT_KEYS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value);
  }
  return `/plan?${query.toString()}`;
}

/**
 * "Plan for your needs →": Plan with these two promos. A plain <a>, because an
 * in-site move would leave the pop-up (a parallel route) open over Plan.
 */
export function PlanLink({ ids, params, names }: { ids: string[]; params: CompareParams; names: [string, string] }) {
  return (
    <a
      href={planHrefFor(ids, params)}
      className="group -mx-2 flex min-h-14 items-center justify-between gap-4 rounded-lg border-t border-line px-2 pt-3 pb-1 hover:bg-band focus-visible:outline-2"
    >
      <h2 className="text-[17px] leading-tight font-[590] tracking-[-0.01em] text-fg">
        Plan for your needs
        <span className="sr-only">
          {" "}
          with {names[0]} and {names[1]}
        </span>
      </h2>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}
