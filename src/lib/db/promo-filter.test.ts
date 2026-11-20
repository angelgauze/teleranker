import { describe, expect, it } from "vitest";
import { computeValueMetrics } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { buildPromoWhere, compatibilityValues, orderForListing } from "./promo-filter";

describe("buildPromoWhere", () => {
  it("lists current and outdated promos by default, not unavailable ones", () => {
    expect(buildPromoWhere({ sort: "value" })).toEqual({ status: { in: ["ACTIVE", "OUTDATED"] } });
  });

  it("drops the status condition when inactive promos are included", () => {
    expect(buildPromoWhere({ sort: "value", includeInactive: true })).toEqual({});
    expect(
      buildPromoWhere({ sort: "value", includeInactive: true, providerId: "dito" }),
    ).toEqual({ providerId: "dito" });
  });

  it("filters by provider", () => {
    expect(buildPromoWhere({ sort: "value", providerId: "dito" })).toEqual({
      status: { in: ["ACTIVE", "OUTDATED"] },
      providerId: "dito",
    });
  });

  it("applies an inclusive budget range in centavos", () => {
    expect(
      buildPromoWhere({ sort: "price", minPriceCentavos: 5000, maxPriceCentavos: 10000 }),
    ).toMatchObject({ priceCentavos: { gte: 5000, lte: 10000 } });
  });

  it("supports a budget with only a minimum or only a maximum", () => {
    expect(buildPromoWhere({ sort: "price", minPriceCentavos: 5000 }).priceCentavos).toEqual({
      gte: 5000,
    });
    expect(buildPromoWhere({ sort: "price", maxPriceCentavos: 10000 }).priceCentavos).toEqual({
      lte: 10000,
    });
  });

  it("keeps a zero budget bound instead of dropping it", () => {
    expect(buildPromoWhere({ sort: "price", minPriceCentavos: 0 }).priceCentavos).toEqual({
      gte: 0,
    });
  });

  it("filters by compatibility", () => {
    expect(buildPromoWhere({ sort: "value", compatibility: "FIVE_G" }).compatibility).toEqual({
      in: ["FIVE_G", "FOUR_G_AND_FIVE_G"],
    });
  });
});

describe("compatibilityValues", () => {
  it("matches dual-network promos for a 4G or 5G filter", () => {
    expect(compatibilityValues("FOUR_G")).toEqual(["FOUR_G", "FOUR_G_AND_FIVE_G"]);
    expect(compatibilityValues("FIVE_G")).toEqual(["FIVE_G", "FOUR_G_AND_FIVE_G"]);
  });

  it("matches dual-network and unverified promos only exactly", () => {
    expect(compatibilityValues("FOUR_G_AND_FIVE_G")).toEqual(["FOUR_G_AND_FIVE_G"]);
    expect(compatibilityValues("UNKNOWN")).toEqual(["UNKNOWN"]);
  });

  it("never treats unverified promos as 4G or 5G", () => {
    expect(compatibilityValues("FOUR_G")).not.toContain("UNKNOWN");
    expect(compatibilityValues("FIVE_G")).not.toContain("UNKNOWN");
  });
});

// Synthetic promos for ordering tests.
function entry(key: string, overrides: Partial<PromoInput>) {
  const promo: PromoInput = {
    providerId: "fixture",
    externalKey: key,
    name: key,
    priceCentavos: 10000,
    dataKind: "TOTAL",
    dataGb: 5,
    validityValue: 7,
    validityUnit: "DAY",
    compatibility: "UNKNOWN",
    status: "ACTIVE",
    ...overrides,
  };
  return { promo, metrics: computeValueMetrics(promo) };
}

describe("orderForListing", () => {
  it("lists every active promo before inactive ones, each group sorted", () => {
    const entries = [
      entry("gone-best", { status: "UNAVAILABLE", dataGb: 50 }),
      entry("active-low", { dataGb: 2 }),
      entry("old", { status: "OUTDATED", dataGb: 1 }),
      entry("active-high", { dataGb: 20 }),
    ];

    // Current first, then outdated, then no longer offered.
    expect(orderForListing(entries, "value").map((item) => item.promo.externalKey)).toEqual([
      "active-high",
      "active-low",
      "old",
      "gone-best",
    ]);
  });
});
