import { describe, expect, it } from "vitest";
import { computeValueMetrics } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { hideDuplicates } from "./promo-duplicates";
import {
  buildPromoWhere,
  compatibilityValues,
  matchesCompatibility,
  matchesValidity,
  normalizeSearch,
  orderForListing,
  MAX_PROVIDER_FILTER,
  parseProviderIds,
  parseValidityBand,
  validityBand,
  VALIDITY_BANDS,
} from "./promo-filter";

describe("parseProviderIds", () => {
  it("reads one or several providers from the address", () => {
    expect(parseProviderIds("dito")).toEqual(["dito"]);
    expect(parseProviderIds(["smart", "globe"])).toEqual(["smart", "globe"]);
  });

  it("drops blanks and repeats, and treats nothing as no filter", () => {
    expect(parseProviderIds(["smart", " ", "smart", " globe "])).toEqual(["smart", "globe"]);
    expect(parseProviderIds(undefined)).toEqual([]);
  });

  it("keeps at most the allowed number of providers", () => {
    const many = Array.from({ length: MAX_PROVIDER_FILTER + 5 }, (_, index) => `p${index}`);
    expect(parseProviderIds(many)).toHaveLength(MAX_PROVIDER_FILTER);
  });
});

describe("buildPromoWhere", () => {
  it("lists current and outdated promos by default, not unavailable ones", () => {
    expect(buildPromoWhere({ sort: "value" })).toEqual({ status: { in: ["ACTIVE", "OUTDATED"] } });
  });

  it("drops the status condition when inactive promos are included", () => {
    expect(buildPromoWhere({ sort: "value", includeInactive: true })).toEqual({});
    expect(
      buildPromoWhere({ sort: "value", includeInactive: true, providerIds: ["dito"] }),
    ).toEqual({ providerId: "dito" });
  });

  it("filters by one provider", () => {
    expect(buildPromoWhere({ sort: "value", providerIds: ["dito"] })).toEqual({
      status: { in: ["ACTIVE", "OUTDATED"] },
      providerId: "dito",
    });
  });

  it("filters by several providers at once", () => {
    expect(buildPromoWhere({ sort: "value", providerIds: ["smart", "globe"] }).providerId).toEqual({
      in: ["smart", "globe"],
    });
  });

  it("does not filter by provider when none is picked", () => {
    expect(buildPromoWhere({ sort: "value", providerIds: [] })).not.toHaveProperty("providerId");
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

  it("leaves the 4G/5G filter out of the query (it runs after duplicates are hidden)", () => {
    expect(buildPromoWhere({ sort: "value", compatibility: "FIVE_G" }).compatibility).toBeUndefined();
  });

  it("filters by compatibility after the query", () => {
    const filter = { sort: "value" as const, compatibility: "FIVE_G" as const };
    expect(matchesCompatibility("FIVE_G", filter)).toBe(true);
    expect(matchesCompatibility("FOUR_G_AND_FIVE_G", filter)).toBe(false);
    expect(matchesCompatibility("FIVE_G", { sort: "value", compatibility: "FOUR_G" })).toBe(false);
    expect(matchesCompatibility("FOUR_G_AND_FIVE_G", { sort: "value", compatibility: "FOUR_G" })).toBe(true);
    expect(matchesCompatibility("UNKNOWN", filter)).toBe(false);
    expect(matchesCompatibility("UNKNOWN", { sort: "value" })).toBe(true);
  });

  it("never lets a hidden duplicate through the 4G/5G filter", () => {
    const copy = (origin: "COLLECTED" | "MANUAL", compatibility: "UNKNOWN" | "FOUR_G_AND_FIVE_G", day: number) => ({
      origin,
      promo: {
        providerId: "globe",
        name: "Go+109",
        priceCentavos: 10900,
        status: "ACTIVE" as const,
        compatibility,
        lastVerifiedAt: new Date(Date.UTC(2026, 10, day)),
      },
    });
    const listed = hideDuplicates([copy("COLLECTED", "UNKNOWN", 26), copy("MANUAL", "FOUR_G_AND_FIVE_G", 18)]);
    const filter = { sort: "value" as const, compatibility: "FOUR_G_AND_FIVE_G" as const };
    // The shown copy is the scraped one; the filter judges that copy, not the hidden one.
    expect(listed.filter(({ promo }) => matchesCompatibility(promo.compatibility, filter))).toEqual([]);
  });

  it("searches promo and provider names, ignoring case", () => {
    expect(buildPromoWhere({ sort: "value", search: "level-up" }).OR).toEqual([
      { name: { contains: "level-up", mode: "insensitive" } },
      { provider: { name: { contains: "level-up", mode: "insensitive" } } },
    ]);
  });

  it("combines a search with the other filters", () => {
    const where = buildPromoWhere({ sort: "value", search: "data", providerIds: ["dito"] });
    expect(where.providerId).toBe("dito");
    expect(where.OR).toHaveLength(2);
  });

  it("adds no search condition without a search", () => {
    expect(buildPromoWhere({ sort: "value" }).OR).toBeUndefined();
  });
});

describe("normalizeSearch", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeSearch("  level   up ")).toBe("level up");
  });

  it("treats blank input as no search", () => {
    expect(normalizeSearch("   ")).toBeUndefined();
    expect(normalizeSearch(undefined)).toBeUndefined();
  });

  it("caps very long input at 60 characters", () => {
    expect(normalizeSearch("x".repeat(500))).toHaveLength(60);
  });
});

describe("compatibilityValues", () => {
  it("lets a 4G phone match dual-network promos, and keeps 5G phone only exact", () => {
    expect(compatibilityValues("FOUR_G")).toEqual(["FOUR_G", "FOUR_G_AND_FIVE_G"]);
    expect(compatibilityValues("FIVE_G")).toEqual(["FIVE_G"]);
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

describe("validity filter", () => {
  const days = (validityValue: number, validityUnit: "DAY" | "WEEK" | "MONTH" = "DAY") => ({
    validityValue,
    validityUnit,
  });

  it("puts day counts into the listing's groups, inclusive at each edge", () => {
    expect(validityBand(days(1))).toBe("1-3");
    expect(validityBand(days(3))).toBe("1-3");
    expect(validityBand(days(4))).toBe("4-7");
    expect(validityBand(days(7))).toBe("4-7");
    expect(validityBand(days(8))).toBe("8-30");
    expect(validityBand(days(30))).toBe("8-30");
    expect(validityBand(days(31))).toBe("31+");
    expect(validityBand(days(360))).toBe("31+");
  });

  it("counts weeks as 7 days and months as 30, like the ranking", () => {
    expect(validityBand(days(1, "WEEK"))).toBe("4-7");
    expect(validityBand(days(2, "WEEK"))).toBe("8-30");
    expect(validityBand(days(1, "MONTH"))).toBe("8-30");
    expect(validityBand(days(2, "MONTH"))).toBe("31+");
  });

  it("keeps no-expiry promos apart from unknown validity", () => {
    expect(validityBand({ noExpiry: true })).toBe("no-expiry");
    expect(validityBand({})).toBeNull();
  });

  it("shows unknown validity only when no group is picked", () => {
    expect(matchesValidity({}, { sort: "value" })).toBe(true);
    for (const band of VALIDITY_BANDS) {
      expect(matchesValidity({}, { sort: "value", validity: band })).toBe(false);
    }
  });

  it("matches only the picked group", () => {
    expect(matchesValidity(days(7), { sort: "value", validity: "4-7" })).toBe(true);
    expect(matchesValidity(days(7), { sort: "value", validity: "8-30" })).toBe(false);
    expect(matchesValidity({ noExpiry: true }, { sort: "value", validity: "no-expiry" })).toBe(true);
  });

  it("reads only known groups from the address", () => {
    expect(parseValidityBand("8-30")).toBe("8-30");
    expect(parseValidityBand("31+")).toBe("31+");
    expect(parseValidityBand("forever")).toBeUndefined();
    expect(parseValidityBand(undefined)).toBeUndefined();
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
