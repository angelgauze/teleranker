import { formatPriceRange, type ProviderSummary } from "@/lib/providers/summary";
import type { PromoCompatibility } from "@/lib/schema/promo";
import { COMPATIBILITY_LABELS } from "@/lib/ui/format";

/** Order the 4G/5G counts are listed in. */
const COMPATIBILITY_ORDER: PromoCompatibility[] = ["FIVE_G", "FOUR_G_AND_FIVE_G", "FOUR_G", "UNKNOWN"];

/** A provider's current promos, price range and 4G/5G counts, all as text. */
export function ProviderFacts({ summary }: { summary: ProviderSummary }) {
  const compatibility = COMPATIBILITY_ORDER.filter((key) => summary.compatibility[key] > 0);

  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-zinc-500 dark:text-zinc-400">Current promos</dt>
      <dd>
        {summary.current}
        {summary.outdated > 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400"> ({summary.outdated} outdated)</span>
        ) : null}
      </dd>
      <dt className="text-zinc-500 dark:text-zinc-400">Price range</dt>
      <dd>{formatPriceRange(summary)}</dd>
      <dt className="text-zinc-500 dark:text-zinc-400">4G/5G</dt>
      <dd>
        <ul>
          {compatibility.map((key) => (
            <li key={key}>
              {COMPATIBILITY_LABELS[key]}: {summary.compatibility[key]}
            </li>
          ))}
        </ul>
      </dd>
    </dl>
  );
}
