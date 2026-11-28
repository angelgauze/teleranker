import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { displayNames, type ComparedPromo } from "@/lib/compare/differences";
import {
  allAccessLead,
  dataPerDayLead,
  priceLead,
  pricePerDayLead,
  valueLead,
  type LeadRule,
} from "@/lib/compare/emphasis";
import { isFourGOnlyPhone } from "@/lib/compare/needs";
import { isSamePromo } from "@/lib/db/promo-duplicates";
import { loadPromosByIds, type PublishedPromo } from "@/lib/db/promos";
import {
  COMPATIBILITY_LABELS,
  COMPATIBILITY_NOTES,
  formatCalls,
  formatDataAllocation,
  formatDate,
  formatGb,
  formatPerDay,
  formatPeso,
  formatTexts,
  formatValidity,
  ORIGIN_LABELS,
  STATUS_LABELS,
} from "@/lib/ui/format";
import {
  Differences,
  PHONE_ROW,
  PhoneSwitch,
  PlanLink,
  type CompareParams,
  type CompareRow,
} from "./compare-extras";
import { CompareFields, type ColumnHead, type FieldRow } from "./compare-fields";
import { RetryButton } from "./retry-button";
import { SourceLink } from "./source-link";

/** The comparison shared by the Compare pop-up and the full Compare page. */

type Row = CompareRow & { lead?: LeadRule };

function valueText(metrics: PublishedPromo["metrics"]): string {
  return metrics.scoreable && metrics.gbPerHundredPesos !== null
    ? metrics.gbPerHundredPesos.toFixed(2)
    : `Not comparable (${metrics.reason ?? "missing data"})`;
}

// What you pay, what you get, how long, then the rest; provider and status sit in the column headers.
const ROWS: Row[] = [
  { label: "Price", value: ({ promo }) => formatPeso(promo.priceCentavos), lead: priceLead },
  {
    label: "Price per day",
    value: ({ promo, metrics }) => formatPerDay(metrics.pricePerDayPhp, "php", promo.noExpiry),
    lead: pricePerDayLead,
  },
  { label: "Value (GB per ₱100)", value: ({ metrics }) => valueText(metrics), lead: valueLead },
  {
    label: "All-access data",
    value: ({ metrics }) => formatGb(metrics.comparableGb),
    lead: allAccessLead,
  },
  {
    label: "Total data",
    value: ({ promo, metrics }) => formatDataAllocation(promo.dataKind, metrics.totalGb),
  },
  {
    label: "Validity",
    value: ({ promo }) => formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry),
  },
  {
    label: "Data per day",
    value: ({ promo, metrics }) => formatPerDay(metrics.dataPerDayGb, "gb", promo.noExpiry),
    lead: dataPerDayLead,
  },
  {
    label: "4G/5G compatibility",
    value: ({ promo, compatibilityCheckedManually }) => {
      const note = COMPATIBILITY_NOTES[promo.compatibility];
      const label = COMPATIBILITY_LABELS[promo.compatibility];
      const shown = note ? `${label} (${note.charAt(0).toLowerCase()}${note.slice(1)})` : label;
      // The scraped copy did not state it; the value comes from the sheet.
      return compatibilityCheckedManually ? `${shown} · checked manually` : shown;
    },
  },
  { label: "Calls", value: ({ promo }) => formatCalls(promo) },
  { label: "Texts", value: ({ promo }) => formatTexts(promo) },
  {
    label: "Last verified",
    value: ({ promo, origin }) =>
      `${formatDate(promo.lastVerifiedAt)} (${ORIGIN_LABELS[origin].toLowerCase()})`,
  },
];

type Compared = PublishedPromo & ComparedPromo;

export type Comparison =
  | { kind: "notice"; title: string; body: React.ReactNode; retry?: boolean }
  | { kind: "ready"; ids: string[]; compared: [Compared, Compared] };

// A plain link: from inside the Compare pop-up an in-site move would leave it open.
const LISTING_LINK = (
  // eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load is what closes the pop-up
  <a href="/" className="text-fg-2 underline underline-offset-4 hover:text-fg">
    promo listing
  </a>
);

/** The picked ids, without blanks or repeats: the same promo twice is one pick, not a comparison. */
export function pickedIds(params: CompareParams): string[] {
  const raw = Array.isArray(params.id) ? params.id : params.id ? [params.id] : [];
  return [...new Set(raw.filter(Boolean))];
}

/** One database read per request, shared by the tab title and the page. */
export const loadPicked = cache((key: string) => loadPromosByIds(key.split(",")));

/** The tab title: "A vs B" for a valid pair, else "Compare promos". */
export async function compareMetadata(searchParams: Promise<CompareParams>): Promise<Metadata> {
  const ids = pickedIds(await searchParams);
  if (ids.length !== 2) return { title: "Compare promos" };
  const { promos } = await loadPicked(ids.join(","));
  return {
    title:
      promos.length === 2 && !isSamePromo(promos[0].promo, promos[1].promo)
        ? displayNames(promos[0], promos[1]).join(" vs ")
        : "Compare promos",
  };
}

/** What to show for an address: the comparison, or the message that explains why not. */
export async function loadComparison(params: CompareParams): Promise<Comparison> {
  const ids = pickedIds(params);

  if (ids.length === 0) {
    return {
      kind: "notice",
      title: "Compare promos",
      body: <p>Pick two promos on the {LISTING_LINK} and choose &ldquo;Compare&rdquo;.</p>,
    };
  }
  if (ids.length === 1) {
    return {
      kind: "notice",
      title: "Pick one more promo",
      body: <p>Comparing needs two promos. Go back to the {LISTING_LINK} and pick a second one.</p>,
    };
  }
  if (ids.length > 2) {
    return {
      kind: "notice",
      title: "Pick at most two promos",
      body: (
        <p>
          You picked {ids.length}. Go back to the {LISTING_LINK} and keep two.
        </p>
      ),
    };
  }

  const { promos, databaseUnavailable } = await loadPicked(ids.join(","));

  if (databaseUnavailable) {
    return {
      kind: "notice",
      title: "Comparison unavailable",
      body: <p>The promo database cannot be reached right now. The listing is not affected.</p>,
      retry: true,
    };
  }

  if (promos.length < 2) {
    return {
      kind: "notice",
      title: "Comparison unavailable",
      body: (
        <p>
          {promos.length === 0
            ? "Neither of the picked promos could be found."
            : `One of the picked promos could not be found, so only ${promos[0].promo.name} is left.`}{" "}
          Pick again on the {LISTING_LINK}.
        </p>
      ),
    };
  }

  if (isSamePromo(promos[0].promo, promos[1].promo)) {
    // The scraped and hand-entered copies of one promo: nothing to compare.
    return {
      kind: "notice",
      title: "You picked the same promo twice",
      body: (
        <p>
          {promos[0].promo.name} is listed once, but we keep one copy from the provider&rsquo;s page
          and one entered manually. Pick a different promo to compare it with on the {LISTING_LINK}.
        </p>
      ),
    };
  }

  const labels = displayNames(promos[0], promos[1]);
  return {
    kind: "ready",
    ids,
    compared: [
      { ...promos[0], label: labels[0] },
      { ...promos[1], label: labels[1] },
    ],
  };
}

/** A message in place of the comparison; `retry` offers "Try again" for a database error. */
export function CompareNotice({
  notice,
  heading: Heading = "h1",
}: {
  notice: Extract<Comparison, { kind: "notice" }>;
  heading?: "h1" | "h2";
}) {
  return (
    <div>
      <Heading className="text-2xl leading-tight font-[590] tracking-[-0.02em] text-fg">{notice.title}</Heading>
      <div className="mt-3 max-w-prose space-y-3 text-[15px] leading-relaxed text-fg-3">{notice.body}</div>
      {notice.retry ? (
        <div className="mt-5">
          <RetryButton />
        </div>
      ) : null}
    </div>
  );
}

function fieldRows(rows: Row[], [a, b]: [Compared, Compared]): FieldRow[] {
  return rows.map((row) => {
    const values: [string, string] = [row.value(a), row.value(b)];
    return {
      label: row.label,
      values,
      same: values[0] === values[1],
      lead: row.lead?.(a, b) ?? null,
    };
  });
}

/** What the comparison covers, and how unknown values are treated. */
const SCOPE = "Compares price, all-access data and validity only; signal and speed are not included.";
const UNKNOWN = "“Unknown” means the value was not published or could not be verified. It is never treated as zero.";

/** The comparison body. `inDialog` adds the Remove marks; the full page adds a way back. */
export function ComparisonBody({
  comparison,
  params,
  inDialog,
}: {
  comparison: Extract<Comparison, { kind: "ready" }>;
  params: CompareParams;
  inDialog: boolean;
}) {
  const { ids, compared } = comparison;
  const inactive = compared.filter(({ promo }) => promo.status !== "ACTIVE");
  const rows = isFourGOnlyPhone(params) ? [PHONE_ROW, ...ROWS] : ROWS;

  return (
    <div className="flex flex-col gap-5 pb-6">
        {inactive.length > 0 ? (
          <p
            role="status"
            className="flex items-start gap-2.5 rounded-[10px] border border-line-strong px-3.5 py-3 text-[13px] leading-normal text-fg-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.01" />
            </svg>
            <span>
              {inactive
                .map(({ label, promo }) => `${label}: ${STATUS_LABELS[promo.status].toLowerCase()}`)
                .join("; ")}
              . Details may no longer match what the provider currently sells.
            </span>
          </p>
        ) : null}

        <Differences a={compared[0]} b={compared[1]} />

        <CompareFields
          heads={[head(compared[0]), head(compared[1])]}
          rows={fieldRows(rows, compared)}
          footer={[
            {
              label: "Source",
              values: [<Source key="a" entry={compared[0]} />, <Source key="b" entry={compared[1]} />],
              same: false,
              lead: null,
            },
          ]}
          tools={<PhoneSwitch ids={ids} params={params} />}
          removable={inDialog}
          surface={inDialog ? "panel" : "canvas"}
        />

        {/* Full page only: a quiet way back, right where you finish comparing. */}
        {inDialog ? null : (
          <p className="-mt-2">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-fg-3 underline-offset-4 hover:text-fg hover:underline"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Back to promos
            </Link>
          </p>
        )}

        <p className="text-[11px] leading-normal text-fg-4 md:text-xs">
          {SCOPE} {UNKNOWN}
        </p>
        <PlanLink ids={ids} params={params} names={[compared[0].label, compared[1].label]} />
    </div>
  );
}

function Source({ entry }: { entry: Compared }) {
  return (
    <SourceLink
      sourceUrl={entry.promo.sourceUrl}
      providerName={entry.providerName}
      providerPromoPageUrl={entry.providerPromoPageUrl}
    />
  );
}

function head(entry: Compared): ColumnHead {
  return {
    id: entry.id,
    name: entry.label,
    providerName: entry.providerName,
    price: formatPeso(entry.promo.priceCentavos),
    status: entry.promo.status,
  };
}
