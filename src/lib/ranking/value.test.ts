import { describe, expect, it } from "vitest";
import type { PromoInput } from "../schema/promo";
import { computeValueMetrics, sortPromos, validityToDays } from "./value";

function promo(overrides: Partial<PromoInput> = {}): PromoInput {
  return {
    providerId: "globe",
    externalKey: "sample",
    name: "Sample promo",
    priceCentavos: 9900,
    dataKind: "TOTAL",
    dataGb: 20,
    allAccessGb: 8,
    validityValue: 7,
    validityUnit: "DAY",
    compatibility: "UNKNOWN",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("validityToDays", () => {
  it("converts days, weeks and months", () => {
    expect(validityToDays(7, "DAY")).toBe(7);
    expect(validityToDays(2, "WEEK")).toBe(14);
    expect(validityToDays(1, "MONTH")).toBe(30);
  });

  it("returns null when validity is unknown", () => {
    expect(validityToDays(undefined, undefined)).toBeNull();
    expect(validityToDays(0, "DAY")).toBeNull();
    expect(validityToDays(7, "FORTNIGHT")).toBeNull();
  });
});

describe("computeValueMetrics", () => {
  it("scores a promo on all-access data", () => {
    const metrics = computeValueMetrics(promo());
    expect(metrics.scoreable).toBe(true);
    expect(metrics.comparableGb).toBe(8);
    expect(metrics.totalGb).toBe(20);
    expect(metrics.validityDays).toBe(7);
    expect(metrics.dataPerDayGb).toBeCloseTo(1.1429, 4);
    expect(metrics.pricePerDayPhp).toBeCloseTo(14.1429, 4);
    expect(metrics.gbPerHundredPesos).toBeCloseTo(8.0808, 4);
  });

  it("falls back to the total when no all-access split is published", () => {
    const metrics = computeValueMetrics(promo({ allAccessGb: undefined, dataGb: 10 }));
    expect(metrics.comparableGb).toBe(10);
    expect(metrics.scoreable).toBe(true);
  });

  it("does not score unlimited plans", () => {
    const metrics = computeValueMetrics(
      promo({ dataKind: "UNLIMITED", dataGb: undefined, allAccessGb: undefined }),
    );
    expect(metrics.scoreable).toBe(false);
    expect(metrics.gbPerHundredPesos).toBeNull();
    expect(metrics.reason).toMatch(/unlimited/i);
  });

  it("does not score promos with unknown validity", () => {
    const metrics = computeValueMetrics(promo({ validityValue: undefined, validityUnit: undefined }));
    expect(metrics.scoreable).toBe(false);
    expect(metrics.reason).toMatch(/validity/i);
  });

  it("scores no-expiry promos on GB per ₱100 without per-day figures", () => {
    // 8 GB all-access for ₱99: (8 ÷ 99) × 100 = 8.0808
    const metrics = computeValueMetrics(
      promo({ validityValue: undefined, validityUnit: undefined, noExpiry: true }),
    );
    expect(metrics.scoreable).toBe(true);
    expect(metrics.gbPerHundredPesos).toBe(8.0808);
    expect(metrics.validityDays).toBeNull();
    expect(metrics.dataPerDayGb).toBeNull();
    expect(metrics.pricePerDayPhp).toBeNull();
    expect(metrics.reason).toBeUndefined();
  });

  it("scores a no-expiry promo exactly like the same promo with a validity period", () => {
    const fixed = computeValueMetrics(promo());
    const forever = computeValueMetrics(
      promo({ validityValue: undefined, validityUnit: undefined, noExpiry: true }),
    );
    expect(forever.gbPerHundredPesos).toBe(fixed.gbPerHundredPesos);
  });

  it("still does not score unlimited or zero-price no-expiry promos", () => {
    const noValidity = { validityValue: undefined, validityUnit: undefined, noExpiry: true };
    expect(
      computeValueMetrics(
        promo({ ...noValidity, dataKind: "UNLIMITED", dataGb: undefined, allAccessGb: undefined }),
      ).scoreable,
    ).toBe(false);
    expect(computeValueMetrics(promo({ ...noValidity, priceCentavos: 0 })).scoreable).toBe(false);
  });

  it("does not score promos with zero price instead of dividing by zero", () => {
    const metrics = computeValueMetrics(promo({ priceCentavos: 0 }));
    expect(metrics.scoreable).toBe(false);
    expect(metrics.reason).toMatch(/price/i);
  });

  it("does not score promos with no verified data", () => {
    const metrics = computeValueMetrics(promo({ dataGb: undefined, allAccessGb: undefined }));
    expect(metrics.scoreable).toBe(false);
  });
});

describe("sortPromos", () => {
  it("orders by value and keeps unscored promos last", () => {
    const promos = [
      promo({ externalKey: "unlimited", name: "Unlimited plan", dataKind: "UNLIMITED", dataGb: undefined, allAccessGb: undefined }),
      promo({ externalKey: "low", name: "Low value", allAccessGb: 2, dataGb: 2, priceCentavos: 10000 }),
      promo({ externalKey: "high", name: "High value", allAccessGb: 8, dataGb: 8, priceCentavos: 10000 }),
    ];

    expect(sortPromos(promos, "value").map((entry) => entry.promo.externalKey)).toEqual([
      "high",
      "low",
      "unlimited",
    ]);
  });

  it("breaks ties by price, then name", () => {
    const promos = [
      promo({ externalKey: "b", name: "B promo", priceCentavos: 9900, dataGb: 8, allAccessGb: 8 }),
      promo({ externalKey: "a", name: "A promo", priceCentavos: 9900, dataGb: 8, allAccessGb: 8 }),
      promo({ externalKey: "cheaper", name: "Cheaper", priceCentavos: 4000, dataGb: 4, allAccessGb: 4 }),
    ];

    expect(sortPromos(promos, "value").map((entry) => entry.promo.externalKey)).toEqual([
      "cheaper",
      "a",
      "b",
    ]);
  });

  it("sorts by price ascending", () => {
    const promos = [
      promo({ externalKey: "expensive", priceCentavos: 29900 }),
      promo({ externalKey: "cheap", priceCentavos: 5000 }),
    ];
    expect(sortPromos(promos, "price").map((entry) => entry.promo.externalKey)).toEqual([
      "cheap",
      "expensive",
    ]);
  });

  it("sorts by validity with no-expiry first and unknown validity last", () => {
    const promos = [
      promo({ externalKey: "unknown", name: "Unknown", validityValue: undefined, validityUnit: undefined }),
      promo({ externalKey: "week", name: "Week", validityValue: 7, validityUnit: "DAY" }),
      promo({ externalKey: "forever", name: "Forever", validityValue: undefined, validityUnit: undefined, noExpiry: true }),
      promo({ externalKey: "month", name: "Month", validityValue: 1, validityUnit: "MONTH" }),
    ];

    expect(sortPromos(promos, "validity").map((entry) => entry.promo.externalKey)).toEqual([
      "forever",
      "month",
      "week",
      "unknown",
    ]);
  });
});
