import Link from "next/link";
import { connection } from "next/server";

// The listing depends on live database state, so it cannot be prerendered.
export const instant = false;
import { loadListing, type PromoFilter } from "@/lib/db/promos";
import type { SortKey } from "@/lib/ranking/value";
import type { PromoCompatibility } from "@/lib/schema/promo";
import {
  COMPATIBILITY_LABELS,
  formatDate,
  formatGb,
  formatPeso,
  formatValidity,
} from "@/lib/ui/format";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "value", label: "Best value (all-access GB per ₱100)" },
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

const NUMBER = /^\d+(?:\.\d{1,2})?$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pesosToCentavos(value: string | undefined): number | undefined {
  if (!value || !NUMBER.test(value)) return undefined;
  return Math.round(Number(value) * 100);
}

function parseFilter(params: Record<string, string | string[] | undefined>): PromoFilter {
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

  return {
    providerId: first(params.provider) || undefined,
    minPriceCentavos: pesosToCentavos(first(params.min)),
    maxPriceCentavos: pesosToCentavos(first(params.max)),
    compatibility,
    sort,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const params = await searchParams;
  const filter = parseFilter(params);
  const { promos, providers, databaseUnavailable } = await loadListing(filter);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Telecom promo comparison · Philippines
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Compare mobile promos</h1>
        <p className="mt-3 max-w-2xl text-zinc-700 dark:text-zinc-300">
          Promos collected from provider pages, with the date each record was last verified.
          Value is ranked on all-access data per peso, not on price alone.
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
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={params.min ?? ""}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="max" className="text-sm font-medium">
            Max budget (₱)
          </label>
          <input
            id="max"
            name="max"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={params.max ?? ""}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
          <select
            id="sort"
            name="sort"
            defaultValue={filter.sort}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
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
      </form>

      {databaseUnavailable ? (
        <section
          role="status"
          className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <h2 className="font-semibold">Database not available</h2>
          <p className="mt-1">
            The promo database is not configured or cannot be reached. Set <code>DATABASE_URL</code>,
            run <code>pnpm db:migrate</code>, then publish a collection run with{" "}
            <code>pnpm scrape --live --publish</code>.
          </p>
        </section>
      ) : promos.length === 0 ? (
        <section
          role="status"
          className="mt-8 rounded-lg border border-zinc-200 p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
        >
          <h2 className="text-base font-semibold">No published promos match these filters</h2>
          <p className="mt-1">
            Run a collection to publish data: <code>pnpm scrape --provider=all --live --publish</code>.
            If a provider has never been collected, its promos will not appear here.
          </p>
        </section>
      ) : (
        <form method="get" action="/compare" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {promos.length} {promos.length === 1 ? "promo" : "promos"} published
              {filter.compatibility === "UNKNOWN"
                ? " · compatibility is not verified for any published promo yet"
                : ""}
            </p>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Compare selected (max 2)
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <caption className="sr-only">
                Published promos with price, data, validity, compatibility and value
              </caption>
              <thead>
                <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">Select for comparison</span>
                  </th>
                  <th scope="col" className="px-2 py-2">Promo</th>
                  <th scope="col" className="px-2 py-2">Price</th>
                  <th scope="col" className="px-2 py-2">Data</th>
                  <th scope="col" className="px-2 py-2">Validity</th>
                  <th scope="col" className="px-2 py-2">4G/5G</th>
                  <th scope="col" className="px-2 py-2">Value</th>
                  <th scope="col" className="px-2 py-2">Verified</th>
                  <th scope="col" className="px-2 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(({ id, promo, metrics, providerName }) => (
                  <tr key={id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        name="id"
                        value={id}
                        aria-label={`Select ${promo.name} for comparison`}
                      />
                    </td>
                    <th scope="row" className="px-2 py-3 text-left font-medium">
                      {promo.name}
                      <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        {providerName}
                      </span>
                    </th>
                    <td className="px-2 py-3 whitespace-nowrap">{formatPeso(promo.priceCentavos)}</td>
                    <td className="px-2 py-3">
                      {promo.dataKind === "UNLIMITED"
                        ? "Unlimited"
                        : promo.dataKind === "NONE"
                          ? "No data"
                          : promo.dataKind === "UNKNOWN"
                            ? "Unknown"
                            : formatGb(metrics.totalGb)}
                      {metrics.comparableGb !== null &&
                      metrics.totalGb !== null &&
                      metrics.comparableGb !== metrics.totalGb ? (
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {formatGb(metrics.comparableGb)} all-access
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {formatValidity(promo.validityValue, promo.validityUnit)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {COMPATIBILITY_LABELS[promo.compatibility]}
                    </td>
                    <td className="px-2 py-3">
                      {metrics.scoreable && metrics.gbPerHundredPesos !== null ? (
                        <>
                          <span className="font-medium">
                            {metrics.gbPerHundredPesos.toFixed(2)} GB per ₱100
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {metrics.dataPerDayGb?.toFixed(2)} GB/day · ₱
                            {metrics.pricePerDayPhp?.toFixed(2)}/day
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-zinc-600 dark:text-zinc-400">Not comparable</span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {metrics.reason}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {formatDate(promo.lastVerifiedAt)}
                    </td>
                    <td className="px-2 py-3">
                      {promo.sourceUrl ? (
                        <a
                          href={promo.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          Official source
                        </a>
                      ) : (
                        <span className="text-zinc-600 dark:text-zinc-400">No source link</span>
                      )}
                    </td>
                  </tr>
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
          data does not inflate the score. Unlimited promos and promos with unknown data or validity
          are listed but not scored. Coverage and speed are not part of the score because no
          reliable data source has been agreed yet.
        </p>
      </section>
    </main>
  );
}
