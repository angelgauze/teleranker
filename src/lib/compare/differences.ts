import type { ScoredPromo } from "../ranking/value";
import type { PromoOrigin } from "../schema/promo";
import { COMPATIBILITY_LABELS, formatGb, formatPeso } from "../ui/format";

/**
 * Compare phase 1: the gaps between two promos, in plain words.
 *
 * Only objective differences from stored data: price, all-access data,
 * validity, GB per ₱100 and 4G/5G support. Unknown values say so; they are
 * never treated as zero, and nothing is called "best".
 */

export interface ComparedPromo extends ScoredPromo {
  /** The name shown to the visitor (see `displayNames`). */
  label: string;
}

interface Named {
  promo: { name: string; priceCentavos: number };
  providerName: string;
  /** Collected or entered manually; tells apart two copies of one promo. */
  origin?: PromoOrigin;
}

const SOURCE: Record<PromoOrigin, string> = {
  COLLECTED: "checked automatically",
  MANUAL: "checked manually",
};

/**
 * Promo names, never the same twice. When both promos share a name, the first
 * difference is added: the provider, then the price, then the source (the
 * scraped and hand-entered copies of one promo), else a number.
 */
export function displayNames(a: Named, b: Named): [string, string] {
  const name = (entry: Named, extra: string) => `${entry.promo.name} (${extra})`;
  if (a.promo.name !== b.promo.name) return [a.promo.name, b.promo.name];
  if (a.providerName !== b.providerName) return [name(a, a.providerName), name(b, b.providerName)];
  if (a.promo.priceCentavos !== b.promo.priceCentavos) {
    return [name(a, formatPeso(a.promo.priceCentavos)), name(b, formatPeso(b.promo.priceCentavos))];
  }
  if (a.origin && b.origin && a.origin !== b.origin) return [name(a, SOURCE[a.origin]), name(b, SOURCE[b.origin])];
  return [name(a, "1"), name(b, "2")];
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** Rounds to two places so float noise like 0.30000000000000004 never shows. */
const gb = (value: number) => formatGb(Math.round(value * 100) / 100);

function priceLine(a: ComparedPromo, b: ComparedPromo): string {
  const gap = a.promo.priceCentavos - b.promo.priceCentavos;
  if (gap === 0) return `Same price (${formatPeso(a.promo.priceCentavos)})`;
  const [cheaper, other] = gap < 0 ? [a, b] : [b, a];
  return `${cheaper.label} is ${formatPeso(Math.abs(gap))} cheaper than ${other.label}`;
}

function dataLine(a: ComparedPromo, b: ComparedPromo): string {
  const kind = (p: ComparedPromo) => p.promo.dataKind;

  if (kind(a) === "UNLIMITED" && kind(b) === "UNLIMITED") return "Both have unlimited data";
  const unknown = [a, b].filter(
    (p) => kind(p) === "UNKNOWN" || (kind(p) === "TOTAL" && p.metrics.comparableGb === null),
  );
  if (unknown.length > 0) {
    return `Data can't be compared: ${unknown.map((p) => p.label).join(" and ")} ${
      unknown.length === 1 ? "has" : "have"
    } no verified data amount`;
  }
  if (kind(a) === "NONE" && kind(b) === "NONE") return "Neither includes data";
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    if (kind(x) === "UNLIMITED") return `${x.label} has unlimited data; ${y.label} ${describeData(y)}`;
    if (kind(x) === "NONE") return `${x.label} includes no data; ${y.label} ${describeData(y)}`;
  }

  const gap = (a.metrics.comparableGb ?? 0) - (b.metrics.comparableGb ?? 0);
  if (Math.abs(gap) < 0.005) return `Same all-access data (${gb(a.metrics.comparableGb ?? 0)})`;
  const [more, other] = gap > 0 ? [a, b] : [b, a];
  return `${more.label} gives ${gb(Math.abs(gap))} more all-access data than ${other.label}`;
}

function describeData(p: ComparedPromo): string {
  if (p.promo.dataKind === "UNLIMITED") return "has unlimited data";
  if (p.promo.dataKind === "NONE") return "includes no data";
  return `has ${gb(p.metrics.comparableGb ?? 0)}`;
}

function validityLine(a: ComparedPromo, b: ComparedPromo): string {
  const noExpiry = (p: ComparedPromo) => Boolean(p.promo.noExpiry);
  if (noExpiry(a) && noExpiry(b)) return "Neither expires";

  const unknown = [a, b].filter((p) => !noExpiry(p) && p.metrics.validityDays === null);
  if (unknown.length > 0) {
    return `Validity can't be compared: unknown for ${unknown.map((p) => p.label).join(" and ")}`;
  }
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    if (noExpiry(x)) return `${x.label} doesn't expire; ${y.label} lasts ${days(y.metrics.validityDays ?? 0)}`;
  }

  const gap = (a.metrics.validityDays ?? 0) - (b.metrics.validityDays ?? 0);
  if (gap === 0) return `Same validity (${days(a.metrics.validityDays ?? 0)})`;
  const [longer, other] = gap > 0 ? [a, b] : [b, a];
  return `${longer.label} lasts ${days(Math.abs(gap))} longer than ${other.label}`;
}

function valueLine(a: ComparedPromo, b: ComparedPromo): string {
  const notScored = [a, b].filter((p) => !p.metrics.scoreable || p.metrics.gbPerHundredPesos === null);
  if (notScored.length > 0) {
    return `Value per peso can't be compared for ${notScored.map((p) => p.label).join(" and ")}`;
  }
  const va = a.metrics.gbPerHundredPesos ?? 0;
  const vb = b.metrics.gbPerHundredPesos ?? 0;
  if (va.toFixed(2) === vb.toFixed(2)) return `Same data per peso (${va.toFixed(2)} GB per ₱100)`;
  const [more, other] = va > vb ? [a, b] : [b, a];
  const hi = Math.max(va, vb).toFixed(2);
  const lo = Math.min(va, vb).toFixed(2);
  return `${more.label} gives more data per peso (${hi} vs ${lo} GB per ₱100 for ${other.label})`;
}

function compatibilityLine(a: ComparedPromo, b: ComparedPromo): string {
  const ca = a.promo.compatibility;
  const cb = b.promo.compatibility;
  if (ca === cb) {
    return ca === "UNKNOWN"
      ? "4G/5G support is not verified for either promo"
      : `Same 4G/5G support (${COMPATIBILITY_LABELS[ca]})`;
  }
  return `Different 4G/5G support: ${a.label}: ${COMPATIBILITY_LABELS[ca]}; ${b.label}: ${COMPATIBILITY_LABELS[cb]}`;
}

/** One line each for price, data, validity, value and 4G/5G support, in that order. */
export function describeDifferences(a: ComparedPromo, b: ComparedPromo): string[] {
  return [priceLine(a, b), dataLine(a, b), validityLine(a, b), valueLine(a, b), compatibilityLine(a, b)];
}
