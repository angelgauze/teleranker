import type { PromoCompatibility } from "../schema/promo";

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
): string {
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

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  OUTDATED: "Outdated",
  UNAVAILABLE: "No longer offered",
};

export function formatDate(date: Date | undefined): string {
  if (!date) return "Unknown";
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}
