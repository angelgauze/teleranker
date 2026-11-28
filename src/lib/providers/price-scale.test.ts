import { describe, expect, it } from "vitest";
import { priceScale, rangeBar, scalePercent, scaleTicks } from "./price-scale";

describe("priceScale", () => {
  it("spans the lowest and highest price across providers, ignoring missing ones", () => {
    expect(
      priceScale([
        { minPriceCentavos: 1000, maxPriceCentavos: 99900 },
        { minPriceCentavos: 3000, maxPriceCentavos: 349900 },
        { minPriceCentavos: null, maxPriceCentavos: null },
      ]),
    ).toEqual({ lo: 10, hi: 3499 });
  });

  it("is null when nobody has a price", () => {
    expect(priceScale([{ minPriceCentavos: null, maxPriceCentavos: null }])).toBeNull();
  });

  it("widens a single price so the bar has room", () => {
    expect(priceScale([{ minPriceCentavos: 9900, maxPriceCentavos: 9900 }])).toEqual({ lo: 49.5, hi: 198 });
  });
});

describe("scale positions", () => {
  const scale = { lo: 10, hi: 1000 };

  it("spaces powers of ten evenly (logarithmic)", () => {
    expect(scalePercent(10, scale)).toBe(0);
    expect(scalePercent(100, scale)).toBe(50);
    expect(scalePercent(1000, scale)).toBe(100);
  });

  it("marks each power of ten inside the scale", () => {
    expect(scaleTicks({ lo: 10, hi: 3499 }).map((tick) => tick.pesos)).toEqual([10, 100, 1000]);
    expect(scaleTicks({ lo: 20, hi: 2499 }).map((tick) => tick.pesos)).toEqual([100, 1000]);
  });

  it("keeps a bar visible and inside the track", () => {
    expect(rangeBar(10000, 10000, scale)).toEqual({ left: 50, width: 2 });
    expect(rangeBar(100000, 100000, scale)).toEqual({ left: 98, width: 2 });
  });
});
