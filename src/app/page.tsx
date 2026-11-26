import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

// The listing depends on live database state, so it cannot be prerendered.
export const instant = false;

// The root layout's title template does not apply to the page beside it, so spell it out.
export const metadata: Metadata = { title: { absolute: "Mobile promos · TeleRanker" } };
import { CompareCheckbox, CompareSubmitButton, CompareTray } from "./_components/compare-picker";
import { DatabaseNotice } from "./_components/database-notice";
import { ProviderBadge } from "./_components/provider-badge";
import { SourceLink } from "./_components/source-link";
import {
  loadListing,
  type PromoFilter,
  type PublishedPromo,
} from "@/lib/db/promos";
import { normalizeSearch } from "@/lib/db/promo-filter";
import { OUTDATED_AFTER_DAYS } from "@/lib/freshness";
import { PAGE_SIZE, parseShowCount, showMoreHref } from "@/lib/ui/paging";
import { parseBudgetRange, type BudgetRange } from "@/lib/money";
import type { SortKey } from "@/lib/ranking/value";
import type { PromoCompatibility } from "@/lib/schema/promo";
import {
  COMPATIBILITY_LABELS,
  COMPATIBILITY_NOTES,
  formatCalls,
  formatChecked,
  formatDataAllocation,
  formatGb,
  formatPerDay,
  formatPeso,
  formatStatus,
  formatTexts,
  formatValidity,
} from "@/lib/ui/format";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "value", label: "Most all-access GB per ₱100" },
  { value: "price", label: "Lowest price first" },
  { value: "data", label: "Most data first" },
  { value: "validity", label: "Longest validity first" },
];

// Phone compatibility (CLAUDE.md): a 5G phone runs every verified promo, so the
// useful questions are "does it work on my 4G phone?" and "which need 5G?".
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

const FIELD_CLASS =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const MUTED = "text-zinc-500 dark:text-zinc-400";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Changes whenever any filter in the address changes, so the form shows the current filters. */
function filterFormKey(params: Record<string, string | string[] | undefined>): string {
  return ["q", "provider", "min", "max", "compatibility", "sort", "inactive"]
    .map((name) => `${name}=${first(params[name]) ?? ""}`)
    .join("&");
}

function parseFilter(params: Record<string, string | string[] | undefined>): {
  filter: PromoFilter;
  budget: BudgetRange;
} {
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
      providerId: first(params.provider) || undefined,
      minPriceCentavos: budget.minCentavos,
      maxPriceCentavos: budget.maxCentavos,
      compatibility,
      includeInactive: first(params.inactive) === "1",
      search: normalizeSearch(first(params.q)),
      sort,
    },
    budget,
  };
}

/**
 * One cell. Below the xl breakpoint the table collapses into cards (two columns
 * from md), so each cell shows its own label; from xl up the column header
 * takes over and the inline label is hidden (display: none also removes it for
 * screen readers).
 */
function Cell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`flex gap-3 px-2 py-1 xl:table-cell xl:py-3 ${className}`}>
      <span className={`w-28 shrink-0 text-xs font-medium xl:hidden ${MUTED}`}>{label}</span>
      <span className="min-w-0">{children}</span>
    </td>
  );
}

function PromoRow({ entry }: { entry: PublishedPromo }) {
  const { id, promo, metrics, providerName } = entry;
  const inactive = promo.status !== "ACTIVE";

  return (
    <tr
      className={`mb-3 block rounded-lg border border-zinc-200 py-2 align-top md:mb-0 xl:table-row xl:rounded-none xl:border-0 xl:border-b xl:py-0 dark:border-zinc-800 ${
        inactive ? "bg-zinc-50 dark:bg-zinc-900/60" : ""
      }`}
    >
      <td className="float-right px-3 py-1 xl:float-none xl:table-cell xl:px-2 xl:py-3">
        <CompareCheckbox id={id} name={promo.name} className="size-5 xl:size-4" />
      </td>
      <th scope="row" className="block px-2 pt-1 pb-2 text-left font-medium xl:table-cell xl:py-3">
        {promo.name}
        <span className="mt-1 block">
          <Link
            href={`/providers/${promo.providerId}`}
            aria-label={`${providerName} provider page`}
            className="inline-block rounded focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ProviderBadge name={providerName} link />
          </Link>
        </span>
        <span className={`mt-1 block text-xs font-normal ${MUTED}`}>
          {formatChecked(promo.lastVerifiedAt, entry.origin)} ·{" "}
          <SourceLink
            compact
            sourceUrl={promo.sourceUrl}
            providerName={providerName}
            providerPromoPageUrl={entry.providerPromoPageUrl}
          />
        </span>
      </th>
      <Cell label="Status">
        <span className={inactive ? "font-medium text-amber-800 dark:text-amber-300" : ""}>
          {formatStatus(promo.status)}
        </span>
      </Cell>
      <Cell label="Price" className="xl:whitespace-nowrap">
        {formatPeso(promo.priceCentavos)}
      </Cell>
      <Cell label="Data">
        {formatDataAllocation(promo.dataKind, metrics.totalGb)}
        {metrics.comparableGb !== null &&
        metrics.totalGb !== null &&
        metrics.comparableGb !== metrics.totalGb ? (
          <span className={`block text-xs ${MUTED}`}>
            {formatGb(metrics.comparableGb)} all-access
          </span>
        ) : null}
      </Cell>
      <Cell label="Validity" className="xl:whitespace-nowrap">
        {formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry)}
      </Cell>
      <Cell label="4G/5G" className="xl:whitespace-nowrap">
        {COMPATIBILITY_LABELS[promo.compatibility]}
        {entry.compatibilityCheckedManually ? (
          <span className={`block text-xs ${MUTED}`}>Checked manually</span>
        ) : null}
        {COMPATIBILITY_NOTES[promo.compatibility] ? (
          <span className={`block max-w-40 whitespace-normal text-xs ${MUTED}`}>
            {COMPATIBILITY_NOTES[promo.compatibility]}
          </span>
        ) : null}
      </Cell>
      <Cell label="Calls / texts">
        <span className="block">Calls: {formatCalls(promo)}</span>
        <span className="block">Texts: {formatTexts(promo)}</span>
      </Cell>
      <Cell label="Value">
        {metrics.scoreable && metrics.gbPerHundredPesos !== null ? (
          <>
            <span className="font-medium">{metrics.gbPerHundredPesos.toFixed(2)} GB per ₱100</span>
            <span className={`block text-xs ${MUTED}`}>
              {promo.noExpiry
                ? "No expiry, so no per-day figures"
                : `${formatPerDay(metrics.dataPerDayGb, "gb")} · ${formatPerDay(metrics.pricePerDayPhp, "php")}`}
            </span>
          </>
        ) : (
          <>
            <span className="text-zinc-600 dark:text-zinc-400">Not comparable</span>
            <span className={`block text-xs ${MUTED}`}>{metrics.reason}</span>
          </>
        )}
      </Cell>
    </tr>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const params = await searchParams;
  const { filter, budget } = parseFilter(params);
  const { promos, providers, databaseUnavailable } = await loadListing(filter);
  // Any narrowing filter; "no results" then means the filters, not an empty database.
  const filtered = Boolean(
    filter.search ||
      filter.providerId ||
      filter.compatibility ||
      filter.minPriceCentavos !== undefined ||
      filter.maxPriceCentavos !== undefined,
  );
  const count = (status: string) => promos.filter(({ promo }) => promo.status === status).length;
  const activeCount = count("ACTIVE");
  const outdatedCount = count("OUTDATED");
  const unavailableCount = count("UNAVAILABLE");
  // Filters and sorting already ran on every promo; this only limits how many are rendered.
  const shown = Math.min(parseShowCount(first(params.show)), promos.length);
  const visible = promos.slice(0, shown);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-3xl font-semibold tracking-tight">Mobile promos</h1>
        <div className="mt-3 max-w-2xl space-y-1 text-zinc-700 dark:text-zinc-300">
          <p>
            Prepaid promos collected from provider pages or entered manually from them, each with the
            date it was last verified.
          </p>
          <p>Value is ranked on all-access data per peso, not on price alone.</p>
        </div>
      </header>

      <form
        // Remount when the query changes: the fields are uncontrolled, so a link
        // to "/?provider=dito" would otherwise keep the previous selections.
        key={filterFormKey(params)}
        method="get"
        action="/"
        className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-5">
          <label htmlFor="q" className="text-sm font-medium">
            Search promos
          </label>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={60}
            autoComplete="off"
            placeholder="Level-Up"
            defaultValue={filter.search ?? ""}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="provider" className="text-sm font-medium">
            Provider
          </label>
          <select
            id="provider"
            name="provider"
            defaultValue={filter.providerId ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="min" className="text-sm font-medium">
            Min budget (₱)
          </label>
          <input
            id="min"
            name="min"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 50"
            aria-invalid={budget.invalid.min || undefined}
            aria-describedby={budget.errors.length > 0 ? "budget-errors" : undefined}
            defaultValue={first(params.min) ?? ""}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="max" className="text-sm font-medium">
            Max budget (₱)
          </label>
          <input
            id="max"
            name="max"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 1,299"
            aria-invalid={budget.invalid.max || undefined}
            aria-describedby={budget.errors.length > 0 ? "budget-errors" : undefined}
            defaultValue={first(params.max) ?? ""}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="compatibility" className="text-sm font-medium">
            Your phone
          </label>
          <select
            id="compatibility"
            name="compatibility"
            defaultValue={filter.compatibility ?? ""}
            aria-describedby="compatibility-hint"
            className={FIELD_CLASS}
          >
            {COMPATIBILITY_OPTIONS.map((option) => (
              <option key={option.value || "any"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id="compatibility-hint" className={`text-xs ${MUTED}`}>
            5G phones work with every promo.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-sm font-medium">
            Sort by
          </label>
          <select id="sort" name="sort" defaultValue={filter.sort} className={FIELD_CLASS}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <a href="#how-value" className="text-xs underline underline-offset-2">
            How is value calculated?
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2 lg:col-span-5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="inactive"
              value="1"
              defaultChecked={filter.includeInactive}
              className="size-4"
            />
            Include promos that are no longer offered
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Apply filters
            </button>
            <Link href="/" className="text-sm underline underline-offset-2">
              Reset
            </Link>
          </div>
        </div>

        {budget.errors.length > 0 ? (
          <ul
            id="budget-errors"
            role="alert"
            className="text-sm text-amber-900 sm:col-span-2 lg:col-span-5 dark:text-amber-200"
          >
            {budget.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </form>

      {databaseUnavailable ? null : (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Where the data comes from:{" "}
          <Link href="/providers" className="underline underline-offset-2">
            see each provider&rsquo;s page
          </Link>
          .
        </p>
      )}

      {databaseUnavailable ? (
        <DatabaseNotice />
      ) : promos.length === 0 ? (
        <section
          role="status"
          className="mt-8 rounded-lg border border-zinc-200 p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
        >
          {filtered ? (
            <>
              <h2 className="text-base font-semibold">No results found.</h2>
              <p className="mt-1">
                {filter.search ? `No promo or provider name contains "${filter.search}". ` : ""}
                Try another search, a wider budget, or another provider or compatibility.
                {filter.includeInactive
                  ? ""
                  : " Promos that are no longer offered are hidden unless you include them."}
              </p>
              <p className="mt-3">
                <Link href="/" className="underline underline-offset-2">
                  Show all promos
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold">No promos to show yet.</h2>
              <p className="mt-1">Promo details haven&rsquo;t been published yet. Please check back later.</p>
            </>
          )}
        </section>
      ) : (
        <form method="get" action="/compare" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {shown < promos.length ? `Showing ${shown} of ${promos.length} · ` : ""}
              {activeCount} current {activeCount === 1 ? "promo" : "promos"}
              {outdatedCount > 0
                ? ` · ${outdatedCount} outdated (not re-checked in over ${OUTDATED_AFTER_DAYS} days), listed after`
                : ""}
              {unavailableCount > 0 ? ` · ${unavailableCount} no longer offered, listed last` : ""}
              {filter.compatibility === "UNKNOWN"
                ? " · showing promos whose 4G/5G compatibility is not yet verified"
                : filter.compatibility === "FIVE_G"
                  ? " · showing promos that need a 5G phone"
                  : filter.compatibility === "FOUR_G"
                    ? " · showing promos that work on a 4G phone"
                    : ""}
            </p>
            <CompareSubmitButton className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" />
          </div>

          <div className="mt-4 xl:overflow-x-auto">
            <table className="block w-full border-collapse text-sm xl:table xl:min-w-[72rem]">
              <caption className="sr-only">
                Published promos with status, price, data, validity, compatibility, calls and
                texts, value, verification date and source
              </caption>
              <thead className="hidden xl:table-header-group">
                <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">Select for comparison</span>
                  </th>
                  <th scope="col" className="px-2 py-2">Promo</th>
                  <th scope="col" className="px-2 py-2">Status</th>
                  <th scope="col" className="px-2 py-2">Price</th>
                  <th scope="col" className="px-2 py-2">Data</th>
                  <th scope="col" className="px-2 py-2">Validity</th>
                  <th scope="col" className="px-2 py-2">4G/5G</th>
                  <th scope="col" className="px-2 py-2">Calls / texts</th>
                  <th scope="col" className="px-2 py-2">Value</th>
                </tr>
              </thead>
              <tbody className="block md:grid md:grid-cols-2 md:gap-3 xl:table-row-group">
                {visible.map((entry) => (
                  <PromoRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
          {shown < promos.length ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Link
                href={showMoreHref(params, shown)}
                scroll={false}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Show {Math.min(PAGE_SIZE, promos.length - shown)} more
              </Link>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Showing {shown} of {promos.length}
              </p>
            </div>
          ) : null}
        </form>
      )}

      <section className="mt-10 border-t border-zinc-200 pt-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <h2
          id="how-value"
          className="scroll-mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          How value is calculated
        </h2>
        <p className="mt-2 max-w-3xl font-medium text-zinc-800 dark:text-zinc-200">
          Value = (all-access GB ÷ price in pesos) × 100, shown as GB per ₱100.
        </p>
        <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5">
          <li>
            When a provider splits its allowance, only the all-access part counts, so app-specific
            or 5G bonus data does not inflate the score.
          </li>
          <li>Promos that never expire are scored the same way, but have no per-day figures.</li>
          <li>Unlimited promos and promos with unknown data or validity are listed but not scored.</li>
          <li>
            Coverage and speed are not part of the score yet, because no reliable source has been
            agreed. The top promo has the most data per peso; it is not the &ldquo;best&rdquo;
            overall.
          </li>
        </ul>
        <h2 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          About 4G and 5G
        </h2>
        <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5">
          <li>
            &ldquo;5G only&rdquo; promos need a 5G phone and 5G signal where you use them.
          </li>
          <li>
            5G signal can be patchy: coverage maps built from other users&rsquo; tests can show 5G
            in an area where most connections are still on 4G. Check the coverage where you use
            your phone before choosing a 5G-only promo.
          </li>
          <li>&ldquo;4G and 5G&rdquo; promos work on any 4G (LTE) phone.</li>
        </ul>
      </section>
      <CompareTray />
    </main>
  );
}
