import Link from "next/link";
import { connection } from "next/server";

// The listing depends on live database state, so it cannot be prerendered.
export const instant = false;
import { SourceLink } from "../_components/source-link";
import { loadPromosByIds, type PublishedPromo } from "@/lib/db/promos";
import {
  COMPATIBILITY_LABELS,
  COMPATIBILITY_NOTES,
  formatCalls,
  formatDataAllocation,
  formatDate,
  ORIGIN_LABELS,
  formatGb,
  formatPerDay,
  formatPeso,
  formatStatus,
  formatTexts,
  formatValidity,
  STATUS_LABELS,
} from "@/lib/ui/format";

const ROWS: Array<{ label: string; value: (entry: PublishedPromo) => string }> = [
  { label: "Provider", value: ({ providerName }) => providerName },
  { label: "Status", value: ({ promo }) => formatStatus(promo.status) },
  { label: "Price", value: ({ promo }) => formatPeso(promo.priceCentavos) },
  {
    label: "Total data",
    value: ({ promo, metrics }) => formatDataAllocation(promo.dataKind, metrics.totalGb),
  },
  {
    label: "All-access data",
    value: ({ metrics }) => formatGb(metrics.comparableGb),
  },
  {
    label: "Validity",
    value: ({ promo }) => formatValidity(promo.validityValue, promo.validityUnit, promo.noExpiry),
  },
  {
    label: "Data per day",
    value: ({ promo, metrics }) => formatPerDay(metrics.dataPerDayGb, "gb", promo.noExpiry),
  },
  {
    label: "Price per day",
    value: ({ promo, metrics }) => formatPerDay(metrics.pricePerDayPhp, "php", promo.noExpiry),
  },
  {
    label: "Value (GB per ₱100)",
    value: ({ metrics }) =>
      metrics.scoreable && metrics.gbPerHundredPesos !== null
        ? metrics.gbPerHundredPesos.toFixed(2)
        : `Not comparable (${metrics.reason ?? "missing data"})`,
  },
  {
    label: "4G/5G compatibility",
    value: ({ promo }) => {
      const note = COMPATIBILITY_NOTES[promo.compatibility];
      const label = COMPATIBILITY_LABELS[promo.compatibility];
      return note ? `${label} (${note.charAt(0).toLowerCase()}${note.slice(1)})` : label;
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

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const params = await searchParams;
  const ids = (Array.isArray(params.id) ? params.id : params.id ? [params.id] : []).filter(Boolean);

  if (ids.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Compare promos</h1>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Select one or two promos on the{" "}
          <Link href="/" className="underline underline-offset-2">
            promo listing
          </Link>{" "}
          and choose “Compare selected”.
        </p>
      </main>
    );
  }

  if (ids.length > 2) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Select at most two promos</h1>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          You selected {ids.length}. Please return to the listing and select no more than two.
        </p>
        <p className="mt-4">
          <Link href="/" className="underline underline-offset-2">
            Back to the listing
          </Link>
        </p>
      </main>
    );
  }

  const { promos, databaseUnavailable } = await loadPromosByIds(ids);
  const inactive = promos.filter(({ promo }) => promo.status !== "ACTIVE");

  if (databaseUnavailable) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Comparison unavailable</h1>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          The promo database cannot be reached. Try again once the database is configured.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-sm">
        <Link href="/" className="underline underline-offset-2">
          ← Back to the listing
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Compare promos</h1>

      {promos.length > 0 && promos.length < ids.length ? (
        <p
          role="status"
          className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          One of the selected promos could not be found and was left out.
        </p>
      ) : null}

      {inactive.length > 0 ? (
        <p
          role="status"
          className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {inactive
            .map(({ promo }) => `${promo.name}: ${STATUS_LABELS[promo.status].toLowerCase()}`)
            .join("; ")}
. Details may no longer match what the provider currently sells.
        </p>
      ) : null}

      {promos.length === 0 ? (
        <p className="mt-4 text-zinc-700 dark:text-zinc-300">
          None of the selected promos could be found.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Field-by-field comparison of the selected promos</caption>
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th scope="col" className="w-40 px-2 py-2 text-left">Field</th>
                {promos.map(({ id, promo }) => (
                  <th key={id} scope="col" className="px-2 py-2 text-left">
                    {promo.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-2 py-2 text-left font-medium">
                    {row.label}
                  </th>
                  {promos.map((entry) => (
                    <td key={entry.id} className="px-2 py-2">
                      {row.value(entry)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-2 py-2 text-left font-medium">Source</th>
                {promos.map(({ id, promo, providerName, providerPromoPageUrl }) => (
                  <td key={id} className="px-2 py-2">
                    <SourceLink
                      sourceUrl={promo.sourceUrl}
                      providerName={providerName}
                      providerPromoPageUrl={providerPromoPageUrl}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        “Unknown” means the value was not published or could not be verified. It is never treated
        as zero.
      </p>
    </main>
  );
}
