import Link from "next/link";
import type { ComparedPromo } from "@/lib/compare/differences";
import type { Needs, Plan } from "@/lib/compare/needs";
import type { PublishedPromo } from "@/lib/db/promos";
import type { OkPlan, PlanRanking } from "@/lib/plan/rank";
import { formatGb, formatPeso, formatValidity } from "@/lib/ui/format";
import { CompareCheckbox } from "./compare-picker";
import { BAND, GRID, LABEL_CELL, ROW, TABLE_BLEED, TAG, VALUE_CELL, valueTone } from "./compare-table";
import { ProviderBadge } from "./provider-badge";

/** The Plan page's results: the one-line answer, the ranked list, the two-promo table. */

export const pluralDays = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const buysText = (buys: number) => (buys === 1 ? "once" : `${buys} times`);
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function dataText(plan: OkPlan): string {
  if (plan.unlimitedData) return "Unlimited data";
  return plan.totalGb === null ? "Data unknown" : `${formatGb(plan.totalGb)} in total`;
}

function budgetText(plan: OkPlan): string | null {
  if (plan.fitsBudget === null || plan.budgetGapCentavos === null) return null;
  return plan.fitsBudget
    ? `Fits your budget, ${formatPeso(plan.budgetGapCentavos)} left`
    : `${formatPeso(-plan.budgetGapCentavos)} over your budget`;
}

/** "₱70 for 7 days · 10 GB": what one buy gives. */
function oneBuy(entry: PublishedPromo): string {
  const { promo, metrics } = entry;
  const validity = formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry);
  const lasts = promo.noExpiry ? ", no expiry" : validity === "Unknown" ? ", validity unknown" : ` for ${validity}`;
  const data =
    promo.dataKind === "UNLIMITED" ? "unlimited data" : metrics.comparableGb === null ? "data unknown" : formatGb(metrics.comparableGb);
  return `${formatPeso(promo.priceCentavos)}${lasts} · ${data}`;
}

const UP = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[3px] size-3.5 shrink-0 text-fg" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
const EQUAL = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[3px] size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
    <path d="M5 9h14M5 15h14" />
  </svg>
);

/** The short answer above the results, in the Compare summary's style. */
export function PlanAnswer({ children, same = false }: { children: React.ReactNode; same?: boolean }) {
  return (
    <p
      role="status"
      className={`flex gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-snug ${
        same ? "text-fg-3" : "text-fg-2"
      }`}
    >
      {same ? EQUAL : UP}
      <span>{children}</span>
    </p>
  );
}

/** The cheapest answer across every promo, with how far ahead it is of the next. */
export function RankingAnswer({ ranking, needs }: { ranking: PlanRanking<PublishedPromo>; needs: Needs }) {
  const [top, next] = ranking.ranked;
  if (!top) return null;
  const days = pluralDays(needs.days);
  if (top.plan.fitsBudget === false) {
    return (
      <PlanAnswer same>
        Nothing fits {formatPeso((needs.budgetPhp ?? 0) * 100)} for {days}. The lowest total is{" "}
        <span className="font-[590] text-fg">{formatPeso(top.plan.totalCentavos)}</span> ({top.entry.promo.name}).
      </PlanAnswer>
    );
  }
  const gap = next ? next.plan.totalCentavos - top.plan.totalCentavos : 0;
  const tied = ranking.ranked.filter(({ plan }) => plan.totalCentavos === top.plan.totalCentavos && plan.fitsBudget !== false);
  if (tied.length > 1) {
    return (
      <PlanAnswer same>
        {tied.length} promos cost the least for {days}:{" "}
        <span className="font-[590] text-fg">{formatPeso(top.plan.totalCentavos)}</span>. The list shows what
        each gives for it.
      </PlanAnswer>
    );
  }
  return (
    <PlanAnswer>
      <span className="font-[590] text-fg">{top.entry.promo.name}</span> costs the least for {days}:{" "}
      <span className="font-[590] text-fg">{formatPeso(top.plan.totalCentavos)}</span>, bought {buysText(top.plan.buys)}
      {gap > 0 ? (
        <span className="ml-2 inline-block rounded bg-selected px-1.5 py-px align-[1px] text-[11px] font-medium whitespace-nowrap text-fg">
          {formatPeso(gap)} less than the next
        </span>
      ) : null}
    </PlanAnswer>
  );
}

/** Current promos by total cost; rows can be picked for Compare. */
export function PlanList({
  ranking,
  shown,
  moreHref,
  lessHref,
  fourGOnly,
  step,
}: {
  ranking: PlanRanking<PublishedPromo>;
  shown: number;
  moreHref: string | null;
  /** Back to the first few; null while only those show. */
  lessHref: string | null;
  fourGOnly: boolean;
  /** How many more each "Show more" adds. */
  step: number;
}) {
  const rows = ranking.ranked.slice(0, shown);
  const top = ranking.ranked[0]?.plan;
  return (
    <div>
      <ol aria-label="Promos by total cost" className="overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map(({ entry, plan }) => {
          const budget = budgetText(plan);
          // Every promo tied for the lowest total is marked, not just the first.
          const lowest = top !== undefined && plan.totalCentavos === top.totalCentavos && plan.fitsBudget !== false;
          return (
            <li
              key={entry.id}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-line-soft px-4 py-3.5 last:border-b-0 ${
                lowest ? BAND : ""
              }`}
            >
              <CompareCheckbox id={entry.id} name={entry.promo.name} className="mt-1 size-[18px] accent-fg" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-snug font-[590] break-words text-fg">
                  {entry.promo.name}
                  {lowest ? <span className="rounded bg-selected px-1.5 py-px text-[11px] font-medium">Lowest cost</span> : null}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-3">
                  <ProviderBadge name={entry.providerName} />
                  {oneBuy(entry)}
                </p>
                <p className="mt-1.5 text-[13px] leading-snug text-fg-2">
                  Buy {buysText(plan.buys)} · {dataText(plan)}
                  {budget ? ` · ${budget}` : ""}
                  {fourGOnly && entry.promo.compatibility === "UNKNOWN" ? " · 4G support not verified" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl leading-tight font-[590] tracking-[-0.02em] text-fg tabular-nums md:text-2xl">
                  {formatPeso(plan.totalCentavos)}
                </p>
                <p className="mt-0.5 text-xs text-fg-4">total</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-fg-3">
        <span>
          Showing {rows.length} of {ranking.ranked.length}
        </span>
        <span className="flex items-center gap-4">
          {lessHref ? (
            <Link
              href={lessHref}
              replace
              scroll={false}
              className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-fg"
            >
              Show less
            </Link>
          ) : null}
          {moreHref ? (
            <Link
              href={moreHref}
              replace
              scroll={false}
              className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 font-medium text-fg-2 hover:border-line-strong hover:text-fg"
            >
              Show {Math.min(step, ranking.ranked.length - rows.length)} more
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** Promos left out of the ranking, each with its reason; never ranked as cheap. */
export function CannotPlan({ ranking }: { ranking: PlanRanking<PublishedPromo> }) {
  const { cannot, leftOut } = ranking;
  const notes = [
    leftOut.noData > 0 ? `${leftOut.noData} without data (calls and texts only)` : null,
    leftOut.needs5G > 0 ? `${leftOut.needs5G} that need a 5G phone` : null,
  ].filter(Boolean);
  if (cannot.length === 0 && notes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 text-[13px] text-fg-3">
      {notes.length > 0 ? <p>Left out: {notes.join(" and ")}.</p> : null}
      {cannot.length > 0 ? (
        <details className="group rounded-xl border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="font-medium text-fg-2">Can&rsquo;t calculate {cannot.length}</span> · a price, validity or
              data amount wasn&rsquo;t published
            </span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <ul className="border-t border-line px-4 py-2">
            {cannot.map(({ entry, reason }) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
                <ProviderBadge name={entry.providerName} />
                <span className="text-fg-2">{entry.promo.name}</span>
                <span className="text-fg-4">· {capitalise(reason)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

type PairRow = {
  label: string;
  values: [string, string];
  notes?: [string?, string?];
  lead?: { index: 0 | 1; tag: string };
};

function pairRows(entries: [ComparedPromo, ComparedPromo], plans: [Plan, Plan], needs: Needs): PairRow[] {
  const each = (pick: (plan: OkPlan, entry: ComparedPromo) => string): [string, string] =>
    plans.map((plan, index) => (plan.state === "cannot" ? "Can’t calculate" : pick(plan, entries[index]))) as [string, string];

  const [ta, tb] = plans.map((plan) => (plan.state === "cannot" ? null : plan.totalCentavos));
  const costLead =
    ta !== null && tb !== null && ta !== tb
      ? { index: (ta < tb ? 0 : 1) as 0 | 1, tag: `${formatPeso(Math.abs(ta - tb))} less` }
      : undefined;

  const rows: PairRow[] = [
    {
      label: "Total cost",
      values: each((plan) => formatPeso(plan.totalCentavos)),
      lead: costLead,
      notes: plans.map((plan) => (plan.state === "cannot" ? capitalise(plan.reason) : undefined)) as [string?, string?],
    },
    {
      label: "How it adds up",
      values: each((plan, entry) => {
        if (plan.buys === 1) return "One buy covers it";
        // More than one buy: the validity runs out, or (when more buys than days need) the data does first.
        const validityDays = entry.promo.noExpiry ? null : entry.metrics.validityDays;
        const buysForDays = validityDays === null ? 1 : Math.ceil(needs.days / validityDays);
        const every =
          validityDays === null || plan.buys > buysForDays ? "as the data runs out" : `every ${pluralDays(validityDays)}`;
        return `${formatPeso(entry.promo.priceCentavos)} × ${plan.buys}, ${every}`;
      }),
    },
    {
      label: needs.dailyGb !== undefined ? `Data (${formatGb(needs.dailyGb)} a day)` : "Data",
      values: each((plan) => (plan.unlimitedData ? "Unlimited" : plan.totalGb === null ? "Unknown" : formatGb(plan.totalGb))),
    },
  ];
  if (plans.some((plan) => plan.state === "ok" && plan.fitsBudget !== null)) {
    rows.push({
      label: "Your budget",
      values: each((plan) =>
        plan.fitsBudget === null || plan.budgetGapCentavos === null
          ? "Unknown"
          : plan.fitsBudget
            ? `Fits, ${formatPeso(plan.budgetGapCentavos)} left`
            : `${formatPeso(-plan.budgetGapCentavos)} over`,
      ),
    });
  }
  return rows;
}

/** The two picked promos side by side for the visitor's needs, in the Compare table's style. */
export function PlanPair({
  entries,
  plans,
  needs,
}: {
  entries: [ComparedPromo & PublishedPromo, ComparedPromo & PublishedPromo];
  plans: [Plan, Plan];
  needs: Needs;
}) {
  const rows = pairRows(entries, plans, needs);
  return (
    <div role="table" aria-label={`Plan for ${pluralDays(needs.days)}`} className={TABLE_BLEED}>
      <div role="row" className={`${GRID} border-y border-line`}>
        <div role="columnheader" className={`${LABEL_CELL} self-end text-fg-4`}>
          For {pluralDays(needs.days)}
        </div>
        {entries.map((entry) => (
          <div key={entry.id} role="columnheader" className={`${VALUE_CELL} border-line`}>
            <ProviderBadge name={entry.providerName} />
            <p className="mt-1.5 text-[13px] leading-tight font-[590] break-words text-fg md:text-[15px]">{entry.label}</p>
            <p className="mt-1 text-xs text-fg-3">{oneBuy(entry)}</p>
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.label} role="row" className={`${ROW} ${row.lead ? BAND : ""}`}>
          <div role="rowheader" className={LABEL_CELL}>
            {row.label}
          </div>
          {row.values.map((value, index) => {
            const leads = row.lead?.index === index;
            return (
              <div key={index} role="cell" className={`${VALUE_CELL} ${valueTone(value === "Can’t calculate", leads)}`}>
                <span className="sr-only">{entries[index].label}: </span>
                {value}
                {leads && row.lead ? <span className={TAG}>{row.lead.tag}</span> : null}
                {row.notes?.[index] ? (
                  <span className="mt-0.5 block text-[11px] text-fg-4 md:text-xs">{row.notes[index]}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The answer for the pair: which costs less for the days, or that they cost the same. */
export function PairAnswer({
  entries,
  plans,
  needs,
}: {
  entries: [ComparedPromo, ComparedPromo];
  plans: [Plan, Plan];
  needs: Needs;
}) {
  const days = pluralDays(needs.days);
  const [a, b] = plans;
  if (a.state === "cannot" || b.state === "cannot") {
    return <PlanAnswer same>One of these can&rsquo;t be calculated for {days}; the table says why.</PlanAnswer>;
  }
  if (a.totalCentavos === b.totalCentavos) {
    return <PlanAnswer same>Both cost {formatPeso(a.totalCentavos)} for {days}.</PlanAnswer>;
  }
  const cheaper = a.totalCentavos < b.totalCentavos ? 0 : 1;
  return (
    <PlanAnswer>
      <span className="font-[590] text-fg">{entries[cheaper].label}</span> costs{" "}
      <span className="font-[590] text-fg">{formatPeso(Math.abs(a.totalCentavos - b.totalCentavos))} less</span> for {days}.
    </PlanAnswer>
  );
}
