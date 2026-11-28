/**
 * Width of a row's GB per ₱100 bar, as a percentage of the highest value in
 * the current list. Null when the promo is not scored or nothing is scored,
 * so an unscored promo never gets a bar (it is not zero, it is not comparable).
 * A scored promo always shows at least a sliver.
 */
export function valueBarPercent(value: number | null, top: number | null): number | null {
  if (value === null || top === null || !Number.isFinite(value) || !(top > 0)) return null;
  const percent = (value / top) * 100;
  return Math.min(100, Math.max(2, Math.round(percent)));
}

/** Highest GB per ₱100 among scored promos, or null when none is scored. */
export function topValue(values: Array<number | null>): number | null {
  const scored = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return scored.length > 0 ? Math.max(...scored) : null;
}
