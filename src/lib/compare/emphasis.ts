import type { ScoredPromo } from "../ranking/value";
import { formatGb, formatPeso } from "../ui/format";

/**
 * Which promo is ahead on a field where more or less is objectively better
 * (price, per-day figures, all-access data, GB per ₱100), and by how much
 * ("₱29 less"). Unknown, unlimited and equal values get no tag.
 */
export interface Lead {
  /** 0 = the first promo, 1 = the second. */
  index: 0 | 1;
  /** Shown beside the value; per-day figures only band the row. */
  tag?: string;
}

export type LeadRule = (a: ScoredPromo, b: ScoredPromo) => Lead | null;

/** Rounds to two places so float noise like 0.30000000000000004 never shows. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Lower price leads. A zero price is not a real price here (never scored), so it gets no tag. */
export const priceLead: LeadRule = (a, b) => {
  const pa = a.promo.priceCentavos;
  const pb = b.promo.priceCentavos;
  if (pa <= 0 || pb <= 0 || pa === pb) return null;
  return { index: pa < pb ? 0 : 1, tag: `${formatPeso(Math.abs(pa - pb))} less` };
};

/** More all-access data leads; unlimited, none and unknown data have no number to compare. */
export const allAccessLead: LeadRule = (a, b) => {
  const ga = a.metrics.comparableGb;
  const gb = b.metrics.comparableGb;
  if (ga === null || gb === null) return null;
  const gap = round2(Math.abs(ga - gb));
  if (gap === 0) return null;
  return { index: ga > gb ? 0 : 1, tag: `${formatGb(gap)} more` };
};

/** Higher GB per ₱100 leads; only when both promos are scored. */
export const valueLead: LeadRule = (a, b) => {
  const va = a.metrics.scoreable ? a.metrics.gbPerHundredPesos : null;
  const vb = b.metrics.scoreable ? b.metrics.gbPerHundredPesos : null;
  if (va === null || vb === null) return null;
  const gap = round2(Math.abs(va - vb));
  if (gap === 0) return null;
  return { index: va > vb ? 0 : 1, tag: `${gap.toFixed(2)} more` };
};

/** Lower price per day leads; no-expiry and unknown validity have no per-day price. */
export const pricePerDayLead: LeadRule = (a, b) => {
  const pa = a.metrics.pricePerDayPhp;
  const pb = b.metrics.pricePerDayPhp;
  if (pa === null || pb === null || round2(pa) === round2(pb)) return null;
  return { index: pa < pb ? 0 : 1 };
};

/** More data per day leads; only when both have a per-day figure. */
export const dataPerDayLead: LeadRule = (a, b) => {
  const da = a.metrics.dataPerDayGb;
  const db = b.metrics.dataPerDayGb;
  if (da === null || db === null || round2(da) === round2(db)) return null;
  return { index: da > db ? 0 : 1 };
};
