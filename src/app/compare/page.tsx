import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { cache } from "react";

// The listing depends on live database state, so it cannot be prerendered.
export const instant = false;
import {
  Differences,
  PHONE_ROW,
  PhoneSwitch,
  PlanForNeeds,
  type CompareRow,
} from "../_components/compare-extras";
import { SourceLink } from "../_components/source-link";
import { displayNames, type ComparedPromo } from "@/lib/compare/differences";
import { isFourGOnlyPhone, parseNeeds } from "@/lib/compare/needs";
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

const ROWS: CompareRow[] = [
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

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-3 space-y-3 text-zinc-700 dark:text-zinc-300">{children}</div>
    </main>
  );
}

const LISTING_LINK = (
  <Link href="/" className="underline underline-offset-2">
    promo listing
  </Link>
);

/** One promo's source cell: its own link, the provider's promo page, or "No source link". */
function Source({ entry }: { entry: PublishedPromo }) {
  return (
    <SourceLink
      sourceUrl={entry.promo.sourceUrl}
      providerName={entry.providerName}
      providerPromoPageUrl={entry.providerPromoPageUrl}
    />
  );
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The picked ids, without blanks or repeats: the same promo twice is one pick, not a comparison. */
function pickedIds(params: Record<string, string | string[] | undefined>): string[] {
  const raw = Array.isArray(params.id) ? params.id : params.id ? [params.id] : [];
  return [...new Set(raw.filter(Boolean))];
}

/** One database read per request, shared by the tab title and the page. */
const loadPicked = cache((key: string) => loadPromosByIds(key.split(",")));

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const ids = pickedIds(await searchParams);
  if (ids.length !== 2) return { title: "Compare promos" };
  const { promos } = await loadPicked(ids.join(","));
  return {
    title: promos.length === 2 ? `${promos[0].promo.name} vs ${promos[1].promo.name}` : "Compare promos",
  };
}

export default async function ComparePage({ searchParams }: Props) {
  await connection();

  const params = await searchParams;
  const ids = pickedIds(params);

  if (ids.length === 0) {
    return (
      <Notice title="Compare promos">
        <p>Pick two promos on the {LISTING_LINK} and choose &ldquo;Compare&rdquo;.</p>
      </Notice>
    );
  }

  if (ids.length === 1) {
    return (
      <Notice title="Pick one more promo">
        <p>Comparing needs two promos. Go back to the {LISTING_LINK} and pick a second one.</p>
      </Notice>
    );
  }

  if (ids.length > 2) {
    return (
      <Notice title="Pick at most two promos">
        <p>
          You picked {ids.length}. Go back to the {LISTING_LINK} and keep two.
        </p>
      </Notice>
    );
  }

  const { promos, databaseUnavailable } = await loadPicked(ids.join(","));

  if (databaseUnavailable) {
    return (
      <Notice title="Comparison unavailable">
        <p>The promo database cannot be reached. Try again once the database is configured.</p>
      </Notice>
    );
  }

  if (promos.length < 2) {
    return (
      <Notice title="Comparison unavailable">
        <p>
          {promos.length === 0
            ? "Neither of the picked promos could be found."
            : `One of the picked promos could not be found, so only ${promos[0].promo.name} is left.`}{" "}
          Pick again on the {LISTING_LINK}.
        </p>
      </Notice>
    );
  }

  const inactive = promos.filter(({ promo }) => promo.status !== "ACTIVE");
  const labels = displayNames(promos[0], promos[1]);
  const compared: ComparedPromo[] = promos.map((entry, index) => ({ ...entry, label: labels[index] }));
  const rows = isFourGOnlyPhone(params) ? [PHONE_ROW, ...ROWS] : ROWS;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-sm">
        <Link href="/" className="underline underline-offset-2">
          <span aria-hidden="true">←</span> Back to the listing
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Compare promos</h1>

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

      <Differences a={compared[0]} b={compared[1]} />
      <PhoneSwitch ids={ids} params={params} />

      {/* Phones: one field at a time, the two values side by side, names pinned on top. */}
      <div className="mt-6 md:hidden">
        <div className="sticky top-0 z-10 grid grid-cols-2 gap-3 border-b border-zinc-300 bg-white py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-950">
          {promos.map(({ id, promo }) => (
            <p key={id} className="min-w-0 break-words">
              {promo.name}
            </p>
          ))}
        </div>
        {rows.map((row) => (
          <section key={row.label} className="border-b border-zinc-200 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{row.label}</h2>
            <div className="mt-1 grid grid-cols-2 gap-3 text-sm">
              {promos.map((entry) => (
                <p key={entry.id} className="min-w-0 break-words">
                  <span className="sr-only">{entry.promo.name}: </span>
                  {row.value(entry)}
                </p>
              ))}
            </div>
          </section>
        ))}
        <section className="py-2">
          <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Source</h2>
          <div className="mt-1 grid grid-cols-2 gap-3 text-sm">
            {promos.map((entry) => (
              <p key={entry.id} className="min-w-0 break-words">
                <span className="sr-only">{entry.promo.name}: </span>
                <Source entry={entry} />
              </p>
            ))}
          </div>
        </section>
      </div>

      {/* Tablets and desktops: the field-by-field table. */}
      <div className="mt-6 hidden md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Field-by-field comparison of the selected promos</caption>
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th scope="col" className="w-48 px-2 py-2 text-left">
                Field
              </th>
              {promos.map(({ id, promo }) => (
                <th key={id} scope="col" className="px-2 py-2 text-left">
                  {promo.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
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
              <th scope="row" className="px-2 py-2 text-left font-medium">
                Source
              </th>
              {promos.map((entry) => (
                <td key={entry.id} className="px-2 py-2">
                  <Source entry={entry} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        &ldquo;Unknown&rdquo; means the value was not published or could not be verified. It is
        never treated as zero.
      </p>

      <PlanForNeeds ids={ids} params={params} result={parseNeeds(params)} entries={compared} />
    </main>
  );
}
