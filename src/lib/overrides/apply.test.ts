import { describe, expect, it } from "vitest";
import type { PromoOverride } from "../schema/override";
import type { PromoInput } from "../schema/promo";
import { applyOverrides, describeOverrideReport } from "./apply";

// Synthetic test records, not real provider data.
function promo(key: string, overrides: Partial<PromoInput> = {}): PromoInput {
  return {
    providerId: "test",
    externalKey: key,
    name: `Test ${key}`,
    priceCentavos: 5000,
    dataKind: "TOTAL",
    dataGb: 5,
    compatibility: "UNKNOWN",
    status: "ACTIVE",
    ...overrides,
  };
}

function override(key: string, compatibility: PromoOverride["compatibility"]): PromoOverride {
  return {
    providerId: "test",
    externalKey: key,
    compatibility,
    verifiedAt: new Date("2026-11-20T00:00:00+08:00"),
    sourceUrl: "https://example.test/promos",
  };
}

describe("applyOverrides", () => {
  it("replaces compatibility for matching promos and leaves the rest alone", () => {
    const result = applyOverrides(
      [promo("a"), promo("b")],
      [override("a", "FOUR_G_AND_FIVE_G")],
    );

    expect(result.promos.map((p) => p.compatibility)).toEqual(["FOUR_G_AND_FIVE_G", "UNKNOWN"]);
    expect(result.report).toEqual({ matched: 1, unmatched: [], conflicts: [] });
    expect(result.collected).toEqual(new Map([["a", "UNKNOWN"]]));
  });

  it("never changes the number of promos", () => {
    const promos = [promo("a"), promo("b"), promo("c")];
    expect(applyOverrides(promos, [override("b", "FIVE_G"), override("z", "FIVE_G")]).promos).toHaveLength(3);
  });

  it("lists overrides whose promo is not in the set", () => {
    const result = applyOverrides([promo("a")], [override("gone", "FIVE_G")]);
    expect(result.report.unmatched).toEqual(["gone"]);
    expect(result.report.matched).toBe(0);
    expect(result.promos[0].compatibility).toBe("UNKNOWN");
  });

  it("keeps the checked value and reports a conflict when the collector disagrees", () => {
    const result = applyOverrides(
      [promo("a", { compatibility: "FIVE_G" }), promo("b", { compatibility: "FIVE_G" })],
      [override("a", "FOUR_G_AND_FIVE_G"), override("b", "FIVE_G")],
    );

    expect(result.promos.map((p) => p.compatibility)).toEqual(["FOUR_G_AND_FIVE_G", "FIVE_G"]);
    // b agrees with the collector, so it is not a conflict.
    expect(result.report.conflicts).toEqual([
      { externalKey: "a", collected: "FIVE_G", override: "FOUR_G_AND_FIVE_G" },
    ]);
    expect(result.collected.get("a")).toBe("FIVE_G");
  });

  it("does not modify the promos it was given", () => {
    const original = promo("a");
    applyOverrides([original], [override("a", "FIVE_G")]);
    expect(original.compatibility).toBe("UNKNOWN");
  });
});

describe("describeOverrideReport", () => {
  it("summarises matches, unmatched keys and conflicts in one line", () => {
    expect(
      describeOverrideReport({
        matched: 3,
        unmatched: ["old-promo"],
        conflicts: [{ externalKey: "a", collected: "FIVE_G", override: "FOUR_G_AND_FIVE_G" }],
      }),
    ).toBe(
      "3 applied, 1 unmatched (old-promo), 1 conflicts (a: collector FIVE_G, sheet FOUR_G_AND_FIVE_G)",
    );
    expect(describeOverrideReport({ matched: 2, unmatched: [], conflicts: [] })).toBe(
      "2 applied, 0 unmatched, 0 conflicts",
    );
  });
});
