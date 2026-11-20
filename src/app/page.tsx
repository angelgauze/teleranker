import Link from "next/link";
import { connection } from "next/server";

// The listing depends on live database state, so it cannot be prerendered.
export const instant = false;
import { CollectionStatusList } from "./_components/collection-status";
import { ProviderBadge } from "./_components/provider-badge";
import { SourceLink } from "./_components/source-link";
import {
  loadCollectionStatuses,
  loadListing,
  type PromoFilter,
  type PublishedPromo,
} from "@/lib/db/promos";
import { OUTDATED_AFTER_DAYS } from "@/lib/freshness";
import { parseBudgetRange, type BudgetRange } from "@/lib/money";
import type { SortKey } from "@/lib/ranking/value";
import type { PromoCompatibility } from "@/lib/schema/promo";
import {
  COMPATIBILITY_LABELS,
  COMPATIBILITY_NOTES,
  formatCalls,
  formatDataAllocation,
  formatDate,
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

const COMPATIBILITY_OPTIONS: Array<{ value: "" | PromoCompatibility; label: string }> = [
  { value: "", label: "Any compatibility" },
  { value: "FOUR_G", label: "Works on 4G" },
  { value: "FIVE_G", label: "Works on 5G" },
  { value: "FOUR_G_AND_FIVE_G", label: "Works on 4G and 5G" },
  { value: "UNKNOWN", label: "Not yet verified" },
];

const FIELD_CLASS =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const MUTED = "text-zinc-500 dark:text-zinc-400";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(params: Record<string, string | string[] | undefined>): {
  filter: PromoFilter;
  budget: BudgetRange;
} {
  const sortParam = first(params.sort);
  const sort = SORT_OPTIONS.some((option) => option.value === sortParam)
    ? (sortParam as SortKey)
    : "value";

  const compatibilityParam = first(params.compatibility);
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
      sort,
    },
    budget,
  };
}

/**
 * One cell. On phones the table collapses into cards, so each cell shows its
 * own label; from the md breakpoint up the column header takes over and the
 * inline label is hidden (display: none also removes it for screen readers).
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
    <td className={`flex gap-3 px-2 py-1 md:table-cell md:py-3 ${className}`}>
      <span className={`w-28 shrink-0 text-xs font-medium md:hidden ${MUTED}`}>{label}</span>
      <span className="min-w-0">{children}</span>
    </td>
  );
}

function PromoRow({ entry }: { entry: PublishedPromo }) {
  const { id, promo, metrics, providerName } = entry;
  const inactive = promo.status !== "ACTIVE";

  return (
    <tr
      className={`mb-3 block rounded-lg border border-zinc-200 py-2 align-top md:mb-0 md:table-row md:rounded-none md:border-0 md:border-b md:py-0 dark:border-zinc-800 ${
        inactive ? "bg-zinc-50 dark:bg-zinc-900/60" : ""
      }`}
    >
      <td className="float-right px-3 py-1 md:float-none md:table-cell md:px-2 md:py-3">
        <input
          type="checkbox"
          name="id"
          value={id}
          aria-label={`Select ${promo.name} for comparison`}
          className="size-5 md:size-4"
        />
      </td>
      <th scope="row" className="block px-2 pt-1 pb-2 text-left font-medium md:table-cell md:py-3">
        {promo.name}
        <span className="mt-1 block">
          <ProviderBadge name={providerName} />
        </span>
      </th>
      <Cell label="Status">
        <span className={inactive ? "font-medium text-amber-800 dark:text-amber-300" : ""}>
          {formatStatus(promo.status)}
        </span>
      </Cell>
      <Cell label="Price" className="md:whitespace-nowrap">
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
      <Cell label="Validity" className="md:whitespace-nowrap">
        {formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry)}
      </Cell>
      <Cell label="4G/5G" className="md:whitespace-nowrap">
        {COMPATIBILITY_LABELS[promo.compatibility]}
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
      <Cell label="Verified" className="md:whitespace-nowrap">
        {formatDate(promo.lastVerifiedAt)}
      </Cell>
      <Cell label="Source">
        <SourceLink
          sourceUrl={promo.sourceUrl}
          providerName={providerName}
          providerPromoPageUrl={entry.providerPromoPageUrl}
        />
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
  const [{ promos, providers, databaseUnavailable }, statuses] = await Promise.all([
    loadListing(filter),
    loadCollectionStatuses(),
  ]);
  const count = (status: string) => promos.filter(({ promo }) => promo.status === status).length;
  const activeCount = count("ACTIVE");
  const outdatedCount = count("OUTDATED");
  const unavailableCount = count("UNAVAILABLE");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className={`text-sm font-medium tracking-wide uppercase ${MUTED}`}>
          Telecom promo comparison · Philippines
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Compare mobile promos</h1>
        <p className="mt-3 max-w-2xl text-zinc-700 dark:text-zinc-300">
          Promos collected from provider pages or entered by hand from them, with the date each
          record was last verified. Value is ranked on all-access data per peso, not on price
          alone.
        </p>
      </header>

      <form
        method="get"
        action="/"
        className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
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
            4G/5G compatibility
          </label>
          <select
            id="compatibility"
            name="compatibility"
            defaultValue={filter.compatibility ?? ""}
            className={FIELD_CLASS}
          >
            {COMPATIBILITY_OPTIONS.map((option) => (
              <option key={option.value || "any"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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

      {databaseUnavailable ? null : <CollectionStatusList statuses={statuses} />}

      {databaseUnavailable ? (
        <section
          role="status"
          className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <h2 className="font-semibold">Database not available</h2>
          <p className="mt-1">
            The promo database is not configured or cannot be reached. Set <code>DATABASE_URL</code>,
            run <code>pnpm db:migrate</code>, then publish data with{" "}
            <code>pnpm scrape --live --publish</code> or <code>pnpm import:promos --publish</code>.
          </p>
        </section>
      ) : promos.length === 0 ? (
        <section
          role="status"
          className="mt-8 rounded-lg border border-zinc-200 p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
        >
          <h2 className="text-base font-semibold">No published promos match these filters</h2>
          <p className="mt-1">
            Try widening the budget or choosing another provider or compatibility.
            {filter.includeInactive
              ? ""
              : " Promos that are no longer offered are hidden unless you include them."}
          </p>
          <p className="mt-1">
            If nothing has been published yet, run a collection (
            <code>pnpm scrape --provider=all --live --publish</code>) or a manual import (
            <code>pnpm import:promos --file=&lt;csv&gt; --publish</code>).
          </p>
        </section>
      ) : (
        <form method="get" action="/compare" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {activeCount} current {activeCount === 1 ? "promo" : "promos"}
              {outdatedCount > 0
                ? ` · ${outdatedCount} outdated (not re-checked in over ${OUTDATED_AFTER_DAYS} days), listed after`
                : ""}
              {unavailableCount > 0 ? ` · ${unavailableCount} no longer offered, listed last` : ""}
              {filter.compatibility === "UNKNOWN"
                ? " · showing promos whose 4G/5G compatibility is not yet verified"
                : ""}
            </p>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Compare selected (max 2)
            </button>
          </div>

          <div className="mt-4 md:overflow-x-auto">
            <table className="block w-full border-collapse text-sm md:table md:min-w-[72rem]">
              <caption className="sr-only">
                Published promos with status, price, data, validity, compatibility, calls and
                texts, value, verification date and source
              </caption>
              <thead className="hidden md:table-header-group">
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
                  <th scope="col" className="px-2 py-2">Verified</th>
                  <th scope="col" className="px-2 py-2">Source</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {promos.map((entry) => (
                  <PromoRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}

      <section className="mt-10 border-t border-zinc-200 pt-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          How value is calculated
        </h2>
        <p className="mt-2 max-w-3xl">
          Value = (all-access GB ÷ price in pesos) × 100, shown as GB per ₱100. When a provider
          splits its allowance, only the all-access part is compared so app-specific or 5G bonus
          data does not inflate the score. Promos that never expire are scored the same way (validity
          does not enter the formula) but have no per-day figures. Unlimited promos and promos with
          unknown data or validity are listed but not scored. Coverage and speed are not part
          of the score because no reliable data source has been agreed yet, so the top promo is not
          the &ldquo;best&rdquo; overall, only the most data per peso.
        </p>
        <h2 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          About 4G and 5G
        </h2>
        <p className="mt-2 max-w-3xl">
          A &ldquo;5G only&rdquo; promo needs a 5G phone and 5G signal where you use it. 5G signal
          can be patchy: coverage maps built from other users&rsquo; tests can show 5G in an area
          while most connections there are still on 4G. Check the coverage where you use your phone
          before choosing a 5G-only promo. Promos marked &ldquo;4G and 5G&rdquo; work on any 4G
          (LTE) phone.
        </p>
      </section>
    </main>
  );
}
