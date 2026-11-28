import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

// The listing depends on live database state, so it cannot be prerendered.
export const instant = false;

// The root layout's title template does not apply to the page beside it, so spell it out.
export const metadata: Metadata = { title: { absolute: "Promos · TeleRanker" } };
import { CompareCheckbox, CompareTray } from "./_components/compare-picker";
import { HashScroll } from "./_components/hash-scroll";
import { DatabaseNotice } from "./_components/database-notice";
import { ListingControls, type ListingValues } from "./_components/listing-controls";
import { SortMenu } from "./_components/sort-menu";
import {
  loadListing,
  type PromoFilter,
  type PublishedPromo,
} from "@/lib/db/promos";
import {
  normalizeSearch,
  parseProviderIds,
  parseValidityBand,
  type ValidityBand,
} from "@/lib/db/promo-filter";
import { OUTDATED_AFTER_DAYS } from "@/lib/freshness";
import { PAGE_SIZE, parseShowCount, showMoreHref } from "@/lib/ui/paging";
import { parseBudgetRange, type BudgetRange } from "@/lib/money";
import type { SortKey } from "@/lib/ranking/value";
import type { PromoCompatibility } from "@/lib/schema/promo";
import {
  formatCalls,
  formatDataAllocation,
  formatGb,
  formatPerDay,
  formatPeso,
  formatStatus,
  formatTexts,
  formatValidity,
  sourceLinkFor,
} from "@/lib/ui/format";
import { topValue, valueBarPercent } from "@/lib/ui/value-bar";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "value", label: "Most GB per ₱100" },
  { value: "price", label: "Lowest price" },
  { value: "data", label: "Most data" },
  { value: "validity", label: "Longest validity" },
];

const VALIDITY_OPTIONS: Array<{ value: "" | ValidityBand; label: string }> = [
  { value: "", label: "Any" },
  { value: "1-3", label: "1–3 days" },
  { value: "4-7", label: "4–7 days" },
  { value: "8-30", label: "8–30 days" },
  { value: "31+", label: "Over 30 days" },
  { value: "no-expiry", label: "No expiry" },
];

const COMPATIBILITY_OPTIONS: Array<{ value: "" | PromoCompatibility; label: string }> = [
  { value: "", label: "Any phone" },
  { value: "FOUR_G", label: "Works on a 4G phone" },
  { value: "FIVE_G", label: "5G phone only" },
  { value: "UNKNOWN", label: "Not verified yet" },
];

/** Older addresses used "4G and 5G"; it meant the same as "Works on a 4G phone". */
const LEGACY_COMPATIBILITY: Partial<Record<string, PromoCompatibility>> = {
  FOUR_G_AND_FIVE_G: "FOUR_G",
};

/** Shown beside a promo only when it is not the usual "works on any 4G or 5G phone". */
const COMPATIBILITY_FLAGS: Partial<Record<PromoCompatibility, string>> = {
  FIVE_G: "Needs a 5G phone",
  FOUR_G: "4G only",
  UNKNOWN: "4G/5G not verified",
};

const MUTED = "text-fg-4";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(params: Params): { filter: PromoFilter; budget: BudgetRange } {
  const sortParam = first(params.sort);
  const sort = SORT_OPTIONS.some((option) => option.value === sortParam)
    ? (sortParam as SortKey)
    : "value";

  const rawCompatibility = first(params.compatibility);
  const compatibilityParam = (rawCompatibility && LEGACY_COMPATIBILITY[rawCompatibility]) || rawCompatibility;
  const compatibility = COMPATIBILITY_OPTIONS.some(
    (option) => option.value === compatibilityParam && option.value !== "",
  )
    ? (compatibilityParam as PromoCompatibility)
    : undefined;

  const budget = parseBudgetRange(first(params.min), first(params.max));

  return {
    filter: {
      providerIds: parseProviderIds(params.provider),
      minPriceCentavos: budget.minCentavos,
      maxPriceCentavos: budget.maxCentavos,
      compatibility,
      validity: parseValidityBand(first(params.validity)),
      includeInactive: first(params.inactive) === "1",
      search: normalizeSearch(first(params.q)),
      sort,
    },
    budget,
  };
}

/**
 * The listing's address without one filter, or without one value of a filter
 * that can repeat (one provider of several), and back on the first page.
 */
function withoutParam(params: Params, name: string, value?: string): string {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (key === "show") continue;
    for (const text of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      if (!text || (key === name && (value === undefined || text === value))) continue;
      next.append(key, text);
    }
  }
  const query = next.toString();
  return query ? `/?${query}` : "/";
}

/**
 * Why a promo has no GB per ₱100, in a few words for a row. The full rules are
 * under "How value is calculated" (docs/ranking.md).
 */
function shortReason(reason: string | undefined): string {
  if (!reason) return "Not scored";
  if (reason.includes("unlimited")) return "Unlimited data";
  if (reason.includes("data allowance")) return "No data allowance";
  if (reason.includes("price")) return "Price unknown";
  if (reason.includes("validity")) return "Validity unknown";
  return reason;
}

/** Calls and texts; each label stays with its value, so a line only breaks between them. */
function CallsAndTexts({ promo }: { promo: PublishedPromo["promo"] }) {
  const calls = formatCalls(promo);
  const texts = formatTexts(promo);
  if (calls === "Unlimited" && texts === "Unlimited") return <>Unlimited calls and texts</>;
  return (
    <>
      <span className="whitespace-nowrap">Calls: {calls}</span> ·{" "}
      <span className="whitespace-nowrap">Texts: {texts}</span>
    </>
  );
}

/** The phone row's short check line: "Checked Nov 26 · Source" (full source name for screen readers). */
function ShortChecked({ entry }: { entry: PublishedPromo }) {
  const { promo, providerName } = entry;
  const date = promo.lastVerifiedAt
    ? `Checked ${promo.lastVerifiedAt.toLocaleDateString("en-PH", { day: "numeric", month: "short", timeZone: "Asia/Manila" })}`
    : "Check date unknown";
  const link = sourceLinkFor(promo.sourceUrl, providerName, entry.providerPromoPageUrl);
  // The source stays visible (every promo shows its source or says it has none).
  return (
    <span className="whitespace-nowrap">
      {date} ·{" "}
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Source: ${link.label}`}
          className="underline underline-offset-2"
        >
          Source
        </a>
      ) : (
        "No source link"
      )}
    </span>
  );
}

function Flags({ entry }: { entry: PublishedPromo }) {
  const { promo } = entry;
  const compatibilityFlag = COMPATIBILITY_FLAGS[promo.compatibility];
  const flags = [
    promo.status !== "ACTIVE" ? formatStatus(promo.status) : null,
    // The sheet supplied this 4G/5G value for a scraped promo: say so.
    compatibilityFlag && entry.compatibilityCheckedManually
      ? `${compatibilityFlag} (checked manually)`
      : (compatibilityFlag ?? null),
  ].filter((flag): flag is string => flag !== null);
  if (flags.length === 0) return null;
  return (
    <>
      {flags.map((flag) => (
        <span
          key={flag}
          className="rounded-md border border-line-strong px-1.5 text-[11px] leading-[18px] font-medium text-fg-2"
        >
          {flag}
        </span>
      ))}
    </>
  );
}



function AllAccessNote({ entry }: { entry: PublishedPromo }) {
  const { metrics } = entry;
  if (metrics.comparableGb === null || metrics.totalGb === null || metrics.comparableGb === metrics.totalGb) {
    return null;
  }
  return <span className={`block text-xs ${MUTED}`}>{formatGb(metrics.comparableGb)} works on any app</span>;
}

function ValueBar({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  return (
    <span aria-hidden="true" className="block h-1 w-16 overflow-hidden rounded-full bg-line-soft">
      <span className="block h-full rounded-full bg-fg-4" style={{ width: `${percent}%` }} />
    </span>
  );
}

function perDay(entry: PublishedPromo): string {
  const { promo, metrics } = entry;
  if (promo.noExpiry) return "No expiry";
  return `${formatPerDay(metrics.dataPerDayGb, "gb")} · ${formatPerDay(metrics.pricePerDayPhp, "php")}`;
}

/** Desktop row: name and source on the left, numbers right-aligned in fixed columns. */
function PromoTableRow({ entry, top }: { entry: PublishedPromo; top: number | null }) {
  const { id, promo, metrics } = entry;
  const scored = metrics.scoreable && metrics.gbPerHundredPesos !== null;
  return (
    <tr className="border-t border-line-soft has-[:checked]:bg-raised">
      <td className="py-3 pr-1 pl-4 align-middle">
        <CompareCheckbox id={id} name={promo.name} className="block size-[18px] accent-fg" />
      </td>
      <th scope="row" className="px-3 py-3 text-left align-middle font-normal">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-[590] text-fg">{promo.name}</span>
          <Flags entry={entry} />
        </span>
        <span className={`mt-1 block text-xs ${MUTED}`}>
          <span className="font-medium text-fg-3">{entry.providerName} · </span>
          <ShortChecked entry={entry} />
        </span>
      </th>
      <td className="px-3 py-3 text-right align-middle tabular-nums whitespace-nowrap text-fg">
        {formatDataAllocation(promo.dataKind, metrics.totalGb)}
        <AllAccessNote entry={entry} />
      </td>
      <td className="px-3 py-3 text-right align-middle tabular-nums whitespace-nowrap text-fg-2">
        {formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry)}
      </td>
      <td className="px-3 py-3 align-middle text-[13px] leading-snug text-fg-3">
        <CallsAndTexts promo={promo} />
      </td>
      <td className="px-3 py-3 text-right align-middle text-[15px] font-medium tabular-nums whitespace-nowrap text-fg">
        {formatPeso(promo.priceCentavos)}
      </td>
      <td className="py-3 pr-4 pl-3 text-right align-middle">
        {scored ? (
          <>
            <span className="flex items-center justify-end gap-2.5">
              <ValueBar percent={valueBarPercent(metrics.gbPerHundredPesos, top)} />
              <span className="min-w-12 text-[15px] font-[590] text-white tabular-nums">
                {metrics.gbPerHundredPesos!.toFixed(2)}
              </span>
            </span>
            <span className={`mt-1 block text-xs tabular-nums ${MUTED}`}>{perDay(entry)}</span>
          </>
        ) : (
          <>
            <span className="text-sm text-fg-2">Not comparable</span>
            <span className={`mt-1 block text-xs ${MUTED}`}>{shortReason(metrics.reason)}</span>
          </>
        )}
      </td>
    </tr>
  );
}

/** Phone and tablet card: name, provider and source, then the numbers as labelled pairs. */
function PromoListItem({ entry, top }: { entry: PublishedPromo; top: number | null }) {
  const { id, promo, metrics } = entry;
  const scored = metrics.scoreable && metrics.gbPerHundredPesos !== null;
  const allAccess =
    metrics.comparableGb !== null && metrics.totalGb !== null && metrics.comparableGb !== metrics.totalGb;
  return (
    <li className="rounded-xl border border-line bg-surface p-4 has-[:checked]:border-line-strong has-[:checked]:bg-raised">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-[590] text-fg">{promo.name}</p>
          <p className={`mt-1 text-xs ${MUTED}`}>
            <span className="font-medium text-fg-3">{entry.providerName} · </span>
            <ShortChecked entry={entry} />
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5 empty:hidden">
            <Flags entry={entry} />
          </p>
        </div>
        <label className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center">
          <CompareCheckbox id={id} name={promo.name} className="size-5 accent-fg" />
        </label>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-line-soft pt-3.5">
        <div>
          <dt className={`text-xs ${MUTED}`}>Price</dt>
          <dd className="mt-0.5 text-lg leading-tight font-[590] tracking-[-0.02em] text-fg tabular-nums">
            {formatPeso(promo.priceCentavos)}
          </dd>
        </div>
        <div>
          <dt className={`text-xs ${MUTED}`}>GB per ₱100</dt>
          {scored ? (
            <dd className="mt-0.5">
              <span className="block text-lg leading-tight font-[590] text-white tabular-nums">
                {metrics.gbPerHundredPesos!.toFixed(2)}
              </span>
              <span className="mt-1.5 block">
                <ValueBar percent={valueBarPercent(metrics.gbPerHundredPesos, top)} />
              </span>
            </dd>
          ) : (
            <dd className="mt-0.5">
              <span className="block text-sm text-fg-2">Not comparable</span>
              <span className={`block text-xs ${MUTED}`}>{shortReason(metrics.reason)}</span>
            </dd>
          )}
        </div>
        <div>
          <dt className={`text-xs ${MUTED}`}>Data</dt>
          <dd className="mt-0.5 text-sm text-fg tabular-nums">
            {formatDataAllocation(promo.dataKind, metrics.totalGb)}
            {allAccess ? (
              <span className={`block text-xs ${MUTED}`}>{formatGb(metrics.comparableGb)} works on any app</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className={`text-xs ${MUTED}`}>Validity</dt>
          <dd className="mt-0.5 text-sm text-fg tabular-nums">
            {formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry)}
            {scored ? <span className={`block text-xs ${MUTED}`}>{perDay(entry)}</span> : null}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className={`text-xs ${MUTED}`}>Calls and texts</dt>
          <dd className="mt-0.5 text-sm text-fg-2">
            <CallsAndTexts promo={promo} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

/**
 * Short labelled explanations under a help heading: label on the left and text
 * on the right from sm up, label above its text on phones. No bullets.
 */
function HelpRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-5 divide-y divide-line-soft border-y border-line-soft">
      {rows.map(([label, text]) => (
        <div key={label} className="grid gap-x-6 gap-y-1 py-3.5 sm:grid-cols-[9.5rem_1fr]">
          <dt className="text-[13px] font-medium text-fg-3 sm:pt-0.5">{label}</dt>
          <dd className="text-base leading-relaxed text-pretty text-fg-2">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

function FilterPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`Remove filter: ${label}`}
      className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pr-2 pl-3 text-xs text-fg hover:border-line-strong focus-visible:outline-2"
    >
      {label}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3 text-fg-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </Link>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();

  const params = await searchParams;
  const { filter, budget } = parseFilter(params);
  const { promos, providers, databaseUnavailable } = await loadListing(filter);
  const providerIds = filter.providerIds ?? [];

  const count = (status: string) => promos.filter(({ promo }) => promo.status === status).length;
  const activeCount = count("ACTIVE");
  const outdatedCount = count("OUTDATED");
  const unavailableCount = count("UNAVAILABLE");
  // Filters and sorting already ran on every promo; this only limits how many are rendered.
  const shown = Math.min(parseShowCount(first(params.show)), promos.length);
  const visible = promos.slice(0, shown);
  const top = topValue(
    promos.map(({ metrics }) => (metrics.scoreable ? metrics.gbPerHundredPesos : null)),
  );

  const providerName = (id: string) => providers.find((provider) => provider.id === id)?.name ?? id;
  type Pill = { key: string; label: string; href: string };
  const pill = (key: string, label: string): Pill => ({ key, label, href: withoutParam(params, key) });
  const pills: Pill[] = [
    budget.maxCentavos !== undefined ? pill("max", `Up to ${formatPeso(budget.maxCentavos)}`) : null,
    budget.minCentavos !== undefined ? pill("min", `From ${formatPeso(budget.minCentavos)}`) : null,
    filter.search ? pill("q", `“${filter.search}”`) : null,
    filter.validity
      ? pill("validity", VALIDITY_OPTIONS.find((option) => option.value === filter.validity)!.label)
      : null,
    // One pill per provider, so each can be removed on its own.
    ...providerIds.map((id) => ({
      key: `provider-${id}`,
      label: providerName(id),
      href: withoutParam(params, "provider", id),
    })),
    filter.compatibility
      ? pill("compatibility", COMPATIBILITY_OPTIONS.find((option) => option.value === filter.compatibility)!.label)
      : null,
    filter.includeInactive ? pill("inactive", "Including no longer offered") : null,
  ].filter((item): item is Pill => item !== null);
  const filtered = pills.length > 0;
  // "109 of 205 promos": the total is every current promo, so a filtered view loads it once more.
  const totalCurrent = filtered
    ? (await loadListing({ sort: filter.sort })).promos.filter(({ promo }) => promo.status === "ACTIVE").length
    : activeCount;

  const initial: ListingValues = {
    max: first(params.max) ?? "",
    min: first(params.min) ?? "",
    q: filter.search ?? "",
    validity: filter.validity ?? "",
    sort: filter.sort,
    providers: providerIds,
    compatibility: filter.compatibility ?? "",
    inactive: filter.includeInactive ?? false,
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 sm:px-6 md:pt-16 short:pt-7">
      <header className="grid gap-x-12 gap-y-2.5 md:grid-cols-2 md:items-start md:gap-y-4">
        <h1 className="text-[28px] leading-[1.1] font-[560] tracking-[-0.03em] text-balance text-fg md:text-[56px] short:text-[28px] md:leading-[1.05] md:tracking-[-0.035em] short:leading-[1.1]">
          Prepaid
          <br />
          promos
        </h1>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-pretty text-fg-2 md:pt-2 md:text-xl md:leading-[1.45] short:pt-0 short:text-[15px] short:leading-relaxed">
          Checked against each provider&rsquo;s own page, collected automatically where
          possible.{" "}
          <span className="text-fg-4">Signal and speed are not ranked.</span>
        </p>
      </header>

      <div className="mt-6 border-y border-line-soft bg-canvas py-3 sm:sticky sm:top-15 sm:z-20 short:static md:mt-14 short:mt-6">
        <ListingControls
          initial={initial}
          providers={providers.map((provider) => ({ value: provider.id, label: provider.name }))}
          validityOptions={VALIDITY_OPTIONS}
          compatibilityOptions={COMPATIBILITY_OPTIONS}
          budgetInvalid={budget.invalid}
          resultCount={promos.length}
        >
          {pills.length > 0 ? (
            <>
              <span className={`mr-1 text-xs ${MUTED}`}>Showing</span>
              {pills.map((pill) => (
                <FilterPill key={pill.key} href={pill.href} label={pill.label} />
              ))}
              <Link
                href="/"
                scroll={false}
                className="ml-1 flex h-8 items-center text-xs text-fg-3 underline underline-offset-4 hover:text-fg"
              >
                Clear all
              </Link>
            </>
          ) : null}
        </ListingControls>
        {budget.errors.length > 0 ? (
          <ul id="budget-errors" role="alert" className="mt-2.5 text-[13px] text-fg-2">
            {budget.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {databaseUnavailable ? (
        <DatabaseNotice />
      ) : promos.length === 0 ? (
        <section role="status" className="mt-6 rounded-xl border border-line bg-surface p-6 text-sm text-fg-3">
          {filtered ? (
            <>
              <h2 className="text-base font-[590] text-fg">No promos match.</h2>
              <p className="mt-1.5 max-w-[60ch] leading-relaxed">
                {filter.search ? `No promo or provider name contains “${filter.search}”. ` : ""}
                Try a wider budget, another validity, or fewer filters.
                {filter.includeInactive
                  ? ""
                  : " Promos that are no longer offered are hidden unless you include them in Filters."}
              </p>
              <p className="mt-4">
                <Link href="/" className="text-fg underline underline-offset-4">
                  Show all promos
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-[590] text-fg">No promos to show yet.</h2>
              <p className="mt-1.5">Promo details haven&rsquo;t been published yet. Please check back later.</p>
            </>
          )}
        </section>
      ) : (
        <form method="get" action="/compare" className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p role="status" className="min-w-0 text-[13px] text-fg-4 tabular-nums">
              Showing <span className="font-medium text-fg-2">{shown}</span> of{" "}
              <span className="font-medium text-fg-2">{promos.length}</span>
              <span className="hidden sm:inline">
                {" "}
                · {activeCount} current {activeCount === 1 ? "promo" : "promos"}
                {filtered ? ` (of ${totalCurrent})` : ""}
              </span>
            </p>
            <SortMenu value={filter.sort} options={SORT_OPTIONS} query={withoutParam(params, "sort").replace(/^\/\??/, "")} />
          </div>
          {outdatedCount > 0 || unavailableCount > 0 ? (
            <p className={`mb-3 text-xs ${MUTED}`}>
              {outdatedCount > 0
                ? `${outdatedCount} outdated (not re-checked in over ${OUTDATED_AFTER_DAYS} days), listed after current ones. `
                : ""}
              {unavailableCount > 0 ? `${unavailableCount} no longer offered, listed last.` : ""}
            </p>
          ) : null}
          {top === null ? (
            <p className="mb-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-3">
              None of these can be ranked by GB per ₱100: they have unlimited data, no data
              allowance, or a missing price or validity. They&rsquo;re listed so you can still
              compare them.
            </p>
          ) : null}
          {/* With JavaScript the floating compare bar does this; without it, this submits the ticked boxes. */}
          <noscript>
            <p className="mb-3 flex justify-end">
              <button
                type="submit"
                className="h-9 rounded-lg border border-line px-3 text-[13px] font-medium text-fg-2"
              >
                Compare selected
              </button>
            </p>
          </noscript>

          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {visible.map((entry) => (
              <PromoListItem key={entry.id} entry={entry} top={top} />
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface lg:block">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">
                Promos with price, data, validity, calls and texts, GB per ₱100, check date and
                source
              </caption>
              <thead>
                <tr className="text-xs text-fg-4">
                  <th scope="col" className="w-10 py-2.5 pr-1 pl-4">
                    <span className="sr-only">Select for comparison</span>
                  </th>
                  <th scope="col" className="w-[34%] px-3 py-2.5 text-left font-medium">Promo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Data</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Validity</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Calls and texts</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="w-48 py-2.5 pr-4 pl-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      GB per ₱100
                      <button
                        type="button"
                        popoverTarget="value-help"
                        aria-label="What GB per ₱100 means"
                        className="flex size-6 items-center justify-center rounded-full text-fg-3 hover:bg-raised hover:text-fg focus-visible:outline-2"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" />
                        </svg>
                      </button>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <PromoTableRow key={entry.id} entry={entry} top={top} />
                ))}
              </tbody>
            </table>
          </div>

          <div
            id="value-help"
            popover="auto"
            role="note"
            className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-raised p-4 text-sm leading-relaxed text-fg-2 shadow-[0_16px_40px_rgb(0_0_0/0.6)]"
          >
            <p className="font-[590] text-fg">GB per ₱100</p>
            <p className="mt-1">
              Data you can use on any app, for every ₱100 you pay. Higher means more data for your
              money. Data that only works on certain apps is left out.
            </p>
            <a href="#how-value" className="mt-2 inline-block text-fg underline underline-offset-4">
              How we calculate it
            </a>
          </div>

          {shown < promos.length ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Link
                href={showMoreHref(params, shown)}
                scroll={false}
                className="flex h-11 items-center rounded-lg border border-line bg-surface px-5 text-sm font-medium text-fg hover:border-line-strong focus-visible:outline-2"
              >
                Show {Math.min(PAGE_SIZE, promos.length - shown)} more
              </Link>
              <p className={`text-xs tabular-nums ${MUTED}`}>
                Showing {shown} of {promos.length}
              </p>
            </div>
          ) : null}
        </form>
      )}

      <div className="mt-16 divide-y divide-line-soft border-t border-line-soft">
        <section className="grid gap-x-12 gap-y-4 py-10 md:grid-cols-2" aria-labelledby="how-value">
          <h2
            id="how-value"
            className="scroll-mt-20 text-xl leading-tight font-[590] tracking-[-0.02em] text-fg sm:scroll-mt-40 md:text-2xl"
          >
            How value is calculated
          </h2>
          <div>
            <p className="text-lg leading-snug text-pretty text-fg md:text-xl">
              GB per ₱100 = all-access GB ÷ <span className="whitespace-nowrap">price × 100.</span>{" "}
              <span className="text-fg-3">
                The more data you get for your money, the higher it scores.
              </span>
            </p>
            <HelpRows
              rows={[
                ["Split allowances", "Only data you can use on any app counts. App-only or 5G bonus data doesn’t."],
                ["No expiry", "Scored the same way, just without per-day figures."],
                ["Not scored", "Unlimited data, or data or validity that wasn’t published."],
                [
                  "Not included",
                  "Coverage and speed. The top promo gives the most data per peso, not the “best” overall.",
                ],
              ]}
            />
          </div>
        </section>
        <section className="grid gap-x-12 gap-y-4 py-10 md:grid-cols-2" aria-labelledby="about-4g-5g">
          <h2 id="about-4g-5g" className="scroll-mt-20 text-xl leading-tight font-[590] tracking-[-0.02em] text-fg sm:scroll-mt-40 md:text-2xl">
            About 4G and 5G
          </h2>
          <div>
            <p className="text-lg leading-snug text-pretty text-fg md:text-xl">
              No label means it works on any 4G (LTE) phone.
            </p>
            <HelpRows
              rows={[
                ["Needs a 5G phone", "Needs a 5G phone and 5G signal where you use it."],
                [
                  "Patchy 5G",
                  "Coverage maps can show 5G where most connections are still 4G. Check where you actually use your phone.",
                ],
              ]}
            />
            <Link
              href="/providers"
              className="mt-6 inline-flex items-center gap-1.5 text-[15px] text-fg-2 underline underline-offset-4 hover:text-fg"
            >
              Where the data comes from
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
      <CompareTray />
      <HashScroll />
    </main>
  );
}
