import type { PromoInput } from "../schema/promo";

/**
 * Promo value metrics.
 *
 * The formula is documented in docs/ranking.md. It is deliberately made of
 * measurable quantities only (price, data, validity) because no reliable
 * coverage or speed data source exists yet (AGENTS.md section 14).
 */

export const DAYS_PER_WEEK = 7;
/** Prepaid promos are sold in 30-day chunks; this is the conversion used. */
export const DAYS_PER_MONTH = 30;

export type SortKey = "value" | "price" | "data" | "validity";

export interface ValueMetrics {
  /** All-access GB when the provider splits the allowance, else total GB. */
  comparableGb: number | null;
  totalGb: number | null;
  validityDays: number | null;
  /** GB usable per day. */
  dataPerDayGb: number | null;
  /** PHP per day. */
  pricePerDayPhp: number | null;
  /** The headline metric: all-access GB bought per PHP 100. */
  gbPerHundredPesos: number | null;
  scoreable: boolean;
  /** Why the promo cannot be scored. Never treat a missing score as zero. */
  reason?: string;
}

export interface ScoredPromo {
  promo: PromoInput;
  metrics: ValueMetrics;
}

export function validityToDays(
  value: number | undefined,
  unit: string | undefined,
): number | null {
  if (!value || value <= 0) return null;

  switch (unit) {
    case "DAY":
      return value;
    case "WEEK":
      return value * DAYS_PER_WEEK;
    case "MONTH":
      return value * DAYS_PER_MONTH;
    default:
      return null;
  }
}

const round = (value: number, places = 4) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export function computeValueMetrics(
  promo: Pick<
    PromoInput,
    | "priceCentavos"
    | "dataKind"
    | "dataGb"
    | "allAccessGb"
    | "validityValue"
    | "validityUnit"
    | "noExpiry"
  >,
): ValueMetrics {
  const totalGb = promo.dataKind === "TOTAL" ? (promo.dataGb ?? null) : null;
  const comparableGb = promo.dataKind === "TOTAL" ? (promo.allAccessGb ?? promo.dataGb ?? null) : null;
  const validityDays = validityToDays(promo.validityValue, promo.validityUnit);
  const pricePhp = promo.priceCentavos / 100;

  const base: ValueMetrics = {
    comparableGb,
    totalGb,
    validityDays,
    dataPerDayGb: null,
    pricePerDayPhp: null,
    gbPerHundredPesos: null,
    scoreable: false,
  };

  if (promo.dataKind === "UNLIMITED") {
    return { ...base, reason: "unlimited data cannot be compared on a GB basis" };
  }

  if (comparableGb === null || comparableGb <= 0) {
    return { ...base, reason: "no comparable data allowance was verified" };
  }

  if (!(pricePhp > 0)) {
    return { ...base, reason: "price is zero or unknown" };
  }

  // Validity cancels out of GB per ₱100, so a promo that never expires is
  // scored like any other; only the per-day figures do not apply (team
  // decision, 2026-11-20; see docs/ranking.md).
  if (promo.noExpiry) {
    return {
      ...base,
      gbPerHundredPesos: round((comparableGb / pricePhp) * 100),
      scoreable: true,
    };
  }

  if (validityDays === null) {
    return { ...base, reason: "validity period is unknown" };
  }

  return {
    ...base,
    dataPerDayGb: round(comparableGb / validityDays),
    pricePerDayPhp: round(pricePhp / validityDays),
    gbPerHundredPesos: round((comparableGb / pricePhp) * 100),
    scoreable: true,
  };
}

/** Nulls sort last regardless of direction. */
function compareNullableNumbers(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function compareByValue(a: ScoredPromo, b: ScoredPromo): number {
  if (a.metrics.scoreable !== b.metrics.scoreable) {
    return a.metrics.scoreable ? -1 : 1;
  }

  const byValue = compareNullableNumbers(
    a.metrics.gbPerHundredPesos,
    b.metrics.gbPerHundredPesos,
    -1,
  );
  if (byValue !== 0) return byValue;

  const byPrice = a.promo.priceCentavos - b.promo.priceCentavos;
  if (byPrice !== 0) return byPrice;

  return a.promo.name.localeCompare(b.promo.name);
}

export function scorePromos(promos: PromoInput[]): ScoredPromo[] {
  return promos.map((promo) => ({ promo, metrics: computeValueMetrics(promo) }));
}

/** Sorts already-scored entries in place, preserving any extra fields. */
export function sortScored<T extends ScoredPromo>(entries: T[], key: SortKey): T[] {
  switch (key) {
    case "value":
      return entries.sort(compareByValue);
    case "price":
      return entries.sort(
        (a, b) =>
          a.promo.priceCentavos - b.promo.priceCentavos || a.promo.name.localeCompare(b.promo.name),
      );
    case "data":
      return entries.sort(
        (a, b) =>
          compareNullableNumbers(a.metrics.totalGb, b.metrics.totalGb, -1) ||
          a.promo.name.localeCompare(b.promo.name),
      );
    case "validity":
      // No-expiry promos last longest, so they come first; unknown validity last.
      return entries.sort(
        (a, b) =>
          Number(Boolean(b.promo.noExpiry)) - Number(Boolean(a.promo.noExpiry)) ||
          compareNullableNumbers(a.metrics.validityDays, b.metrics.validityDays, -1) ||
          a.promo.name.localeCompare(b.promo.name),
      );
  }
}

export function sortPromos(promos: PromoInput[], key: SortKey): ScoredPromo[] {
  return sortScored(scorePromos(promos), key);
}
