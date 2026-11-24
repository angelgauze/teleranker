import { describe, expect, it } from "vitest";
import { computeValueMetrics } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { describeDifferences, displayNames, type ComparedPromo } from "./differences";

function entry(label: string, overrides: Partial<PromoInput> = {}): ComparedPromo {
  const promo: PromoInput = {
    providerId: "dito",
    name: label,
    priceCentavos: 9900,
    dataKind: "TOTAL",
    dataGb: 10,
    validityValue: 7,
    validityUnit: "DAY",
    compatibility: "FOUR_G_AND_FIVE_G",
    status: "ACTIVE",
    ...overrides,
  };
  return { label, promo, metrics: computeValueMetrics(promo) };
}

describe("describeDifferences", () => {
  it("states objective gaps for price, data, validity, value and 4G/5G", () => {
    const a = entry("A", { priceCentavos: 7000, dataGb: 8, validityValue: 7 });
    const b = entry("B", { priceCentavos: 9900, dataGb: 12.5, validityValue: 30, compatibility: "FIVE_G" });
    expect(describeDifferences(a, b)).toEqual([
      "A is ₱29 cheaper than B",
      "B gives 4.50 GB more all-access data than A",
      "B lasts 23 days longer than A",
      "B gives more data per peso (12.63 vs 11.43 GB per ₱100 for A)",
      "Different 4G/5G support: A: 4G and 5G; B: 5G only",
    ]);
  });

  it("says when values are the same", () => {
    const lines = describeDifferences(entry("A"), entry("B"));
    expect(lines).toEqual([
      "Same price (₱99)",
      "Same all-access data (10 GB)",
      "Same validity (7 days)",
      "Same data per peso (10.10 GB per ₱100)",
      "Same 4G/5G support (4G and 5G)",
    ]);
  });

  it("uses all-access data when the provider splits the allowance", () => {
    const a = entry("A", { dataGb: 20, allAccessGb: 8 });
    const b = entry("B", { dataGb: 10 });
    expect(describeDifferences(a, b)[1]).toBe("B gives 2 GB more all-access data than A");
  });

  it("never treats unknown data or validity as zero", () => {
    const a = entry("A", { dataKind: "UNKNOWN", dataGb: undefined, validityValue: undefined, validityUnit: undefined });
    const b = entry("B");
    const lines = describeDifferences(a, b);
    expect(lines[1]).toBe("Data can't be compared: A has no verified data amount");
    expect(lines[2]).toBe("Validity can't be compared: unknown for A");
    expect(lines[3]).toBe("Value per peso can't be compared for A");
  });

  it("handles unlimited, no data and no expiry in words", () => {
    const unlimited = entry("U", { dataKind: "UNLIMITED", dataGb: undefined });
    const none = entry("N", { dataKind: "NONE", dataGb: undefined, noExpiry: true, validityValue: undefined, validityUnit: undefined });
    const lines = describeDifferences(unlimited, none);
    expect(lines[1]).toBe("U has unlimited data; N includes no data");
    expect(lines[2]).toBe("N doesn't expire; U lasts 7 days");
    expect(lines[3]).toBe("Value per peso can't be compared for U and N");
  });

  it("flags unverified 4G/5G support", () => {
    const lines = describeDifferences(entry("A", { compatibility: "UNKNOWN" }), entry("B", { compatibility: "UNKNOWN" }));
    expect(lines[4]).toBe("4G/5G support is not verified for either promo");
  });
});

describe("displayNames", () => {
  it("adds the provider only when both names match", () => {
    const a = { promo: { name: "GoSURF50" }, providerName: "Globe" };
    const b = { promo: { name: "GoSURF50" }, providerName: "TM" };
    expect(displayNames(a, b)).toEqual(["GoSURF50 (Globe)", "GoSURF50 (TM)"]);
    expect(displayNames(a, { promo: { name: "Other" }, providerName: "DITO" })).toEqual(["GoSURF50", "Other"]);
  });
});
