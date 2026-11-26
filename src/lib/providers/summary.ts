import { effectiveStatus } from "../freshness";
import type { PromoCompatibility, PromoStatus } from "../schema/promo";
import { formatPeso } from "../ui/format";

/**
 * One provider's promos boiled down for its provider page: how many are
 * current, how many of those are outdated, the price range and the 4G/5G
 * counts. "Outdated" follows the listing's 14-day rule (effectiveStatus), so
 * the page and the listing it links to always agree.
 */

export interface SummaryRow {
  /** Stored status; the 14-day rule is applied here. */
  status: PromoStatus;
  priceCentavos: number;
  compatibility: PromoCompatibility;
  lastVerifiedAt: Date | null;
}

export interface ProviderSummary {
  /** Promos still offered (effective status other than UNAVAILABLE). */
  current: number;
  /** Current promos not re-verified within 14 days. */
  outdated: number;
  /** Over current promos priced above ₱0; null when there are none. */
  minPriceCentavos: number | null;
  maxPriceCentavos: number | null;
  /** Current promos per compatibility. */
  compatibility: Record<PromoCompatibility, number>;
}

export function summarizeProviderPromos(rows: SummaryRow[], now: Date): ProviderSummary {
  const summary: ProviderSummary = {
    current: 0,
    outdated: 0,
    minPriceCentavos: null,
    maxPriceCentavos: null,
    compatibility: { FOUR_G: 0, FIVE_G: 0, FOUR_G_AND_FIVE_G: 0, UNKNOWN: 0 },
  };

  for (const row of rows) {
    const status = effectiveStatus(row.status, row.lastVerifiedAt ?? undefined, now);
    if (status === "UNAVAILABLE") continue;

    summary.current += 1;
    if (status === "OUTDATED") summary.outdated += 1;
    summary.compatibility[row.compatibility] += 1;

    if (row.priceCentavos > 0) {
      summary.minPriceCentavos = Math.min(summary.minPriceCentavos ?? row.priceCentavos, row.priceCentavos);
      summary.maxPriceCentavos = Math.max(summary.maxPriceCentavos ?? row.priceCentavos, row.priceCentavos);
    }
  }

  return summary;
}

/** "₱10 – ₱999", "₱99" when every price is the same, "Not available" without prices. */
export function formatPriceRange(summary: ProviderSummary): string {
  const { minPriceCentavos: min, maxPriceCentavos: max } = summary;
  if (min === null || max === null) return "Not available";
  return min === max ? formatPeso(min) : `${formatPeso(min)} – ${formatPeso(max)}`;
}
