import type { PromoCompatibility, PromoInput, PromoOrigin, PromoStatus } from "../schema/promo";

/**
 * Display rule for every price: peso sign, thousands grouped with commas, and
 * centavos only when the amount has some ("₱99", "₱1,299", "₱1,299.50").
 * The output parses back with parsePesoAmount (src/lib/money.ts).
 */
export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const hasCentavos = centavos % 100 !== 0;
  return `₱${pesos.toLocaleString("en-PH", {
    minimumFractionDigits: hasCentavos ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatGb(gb: number | null | undefined): string {
  if (gb === null || gb === undefined) return "Unknown";
  return `${Number.isInteger(gb) ? gb : gb.toFixed(2)} GB`;
}

export function formatValidity(
  value: number | undefined,
  unit: string | undefined,
  noExpiry?: boolean,
): string {
  if (noExpiry) return "No expiry";
  if (!value || !unit) return "Unknown";
  const units: Record<string, string> = { DAY: "day", WEEK: "week", MONTH: "month" };
  const label = units[unit] ?? unit.toLowerCase();
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

export const COMPATIBILITY_LABELS: Record<PromoCompatibility, string> = {
  FOUR_G: "4G only",
  FIVE_G: "5G only",
  FOUR_G_AND_FIVE_G: "4G and 5G",
  UNKNOWN: "Not verified",
};

/** Extra guidance shown next to a compatibility label, where one is needed. */
export const COMPATIBILITY_NOTES: Partial<Record<PromoCompatibility, string>> = {
  FIVE_G: "Needs a 5G phone and 5G signal where you use it",
};

export const STATUS_LABELS: Record<PromoStatus, string> = {
  ACTIVE: "Active",
  OUTDATED: "Outdated",
  UNAVAILABLE: "No longer offered",
};

/** How a listed promo was last checked; collected and hand-entered promos are listed together. */
export const ORIGIN_LABELS: Record<PromoOrigin, string> = {
  COLLECTED: "Checked automatically",
  MANUAL: "Checked manually",
};

/** Status as a text label, so it never depends on color alone. */
export function formatStatus(status: PromoStatus): string {
  return STATUS_LABELS[status];
}

export function formatDate(date: Date | undefined): string {
  if (!date) return "Unknown";
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

/**
 * Calls and texts keep unknown, none and limited distinct:
 * undefined = not stated, 0 = explicitly none, unlimited = false with no
 * count = limited by an amount the source did not give. Call counts are minutes.
 */
export function formatCalls(
  promo: Pick<PromoInput, "callsUnlimited" | "callsIncluded">,
): string {
  if (promo.callsUnlimited) return "Unlimited";
  if (promo.callsIncluded === 0) return "None";
  if (promo.callsIncluded !== undefined) return `${promo.callsIncluded} min`;
  if (promo.callsUnlimited === false) return "Limited (minutes not stated)";
  return "Unknown";
}

export function formatTexts(
  promo: Pick<PromoInput, "textsUnlimited" | "textsIncluded">,
): string {
  if (promo.textsUnlimited) return "Unlimited";
  if (promo.textsIncluded === 0) return "None";
  if (promo.textsIncluded !== undefined) return `${promo.textsIncluded} texts`;
  if (promo.textsUnlimited === false) return "Limited (count not stated)";
  return "Unknown";
}

/**
 * Headline data allowance. Unlimited, none and unknown are labelled, never
 * shown as a number or as zero.
 */
export function formatDataAllocation(
  dataKind: PromoInput["dataKind"],
  totalGb: number | null | undefined,
): string {
  switch (dataKind) {
    case "UNLIMITED":
      return "Unlimited";
    case "NONE":
      return "No data";
    case "UNKNOWN":
      return "Unknown";
    default:
      return formatGb(totalGb);
  }
}

export interface SourceLink {
  href: string;
  label: string;
  /** Explains a fallback link, so it is not mistaken for the promo's own page. */
  note?: string;
}

/**
 * The promo's own official link when it has one; otherwise the provider's
 * general promo page, clearly labelled as such; otherwise null, which the UI
 * shows as an explicit "No source link".
 */
export function sourceLinkFor(
  sourceUrl: string | undefined,
  providerName: string,
  providerPromoPageUrl: string | undefined,
): SourceLink | null {
  if (sourceUrl) return { href: sourceUrl, label: "Official source" };
  if (providerPromoPageUrl) {
    return {
      href: providerPromoPageUrl,
      label: `${providerName} promo page`,
      note: "General page; this promo has no page of its own",
    };
  }
  return null;
}

/**
 * Per-day figures. A promo that never expires has none ("Not applicable"),
 * which is different from a validity nobody published ("Unknown").
 */
export function formatPerDay(
  value: number | null,
  kind: "gb" | "php",
  noExpiry?: boolean,
): string {
  if (value === null) return noExpiry ? "Not applicable (no expiry)" : "Unknown";
  return kind === "gb" ? `${value.toFixed(2)} GB/day` : `₱${value.toFixed(2)}/day`;
}
