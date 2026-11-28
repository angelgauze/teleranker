/**
 * The Providers page's shared price scale: every provider's price range is
 * drawn on one logarithmic axis (₱10, ₱100 and ₱1,000 evenly spaced), so cheap
 * promos are not squeezed into a sliver and ranges compare at a glance.
 */

export interface PriceScale {
  /** Lowest and highest price on the axis, in pesos (> 0). */
  lo: number;
  hi: number;
}

/** The axis spanning every provider's prices; null when nobody has a price. */
export function priceScale(ranges: Array<{ minPriceCentavos: number | null; maxPriceCentavos: number | null }>): PriceScale | null {
  const mins = ranges.map((r) => r.minPriceCentavos).filter((v): v is number => v !== null && v > 0);
  const maxes = ranges.map((r) => r.maxPriceCentavos).filter((v): v is number => v !== null && v > 0);
  if (mins.length === 0 || maxes.length === 0) return null;
  const lo = Math.min(...mins) / 100;
  const hi = Math.max(...maxes) / 100;
  // One price everywhere: widen a little so the bar still has a place to sit.
  return hi > lo ? { lo, hi } : { lo: lo / 2, hi: hi * 2 };
}

/** Where a price sits on the axis, 0–100 (%). */
export function scalePercent(pesos: number, scale: PriceScale): number {
  const span = Math.log10(scale.hi) - Math.log10(scale.lo);
  const at = ((Math.log10(pesos) - Math.log10(scale.lo)) / span) * 100;
  return Math.min(100, Math.max(0, at));
}

/** The bar for one provider's range: left edge and width in %, never thinner than 2%. */
export function rangeBar(
  minPriceCentavos: number,
  maxPriceCentavos: number,
  scale: PriceScale,
): { left: number; width: number } {
  const left = scalePercent(minPriceCentavos / 100, scale);
  const right = scalePercent(maxPriceCentavos / 100, scale);
  const width = Math.max(right - left, 2);
  return { left: Math.min(left, 100 - width), width };
}

/** Axis marks at each power of ten inside the scale (₱10, ₱100, ₱1,000, ...). */
export function scaleTicks(scale: PriceScale): Array<{ pesos: number; percent: number }> {
  const ticks: Array<{ pesos: number; percent: number }> = [];
  for (let pesos = 10 ** Math.ceil(Math.log10(scale.lo)); pesos <= scale.hi; pesos *= 10) {
    ticks.push({ pesos, percent: scalePercent(pesos, scale) });
  }
  return ticks;
}
