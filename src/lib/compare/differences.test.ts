import { describe, expect, it } from "vitest";
import { computeValueMetrics } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { describeDifferences, displayNames, summarizeDifferences, type ComparedPromo } from "./differences";

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
  const named = (name: string, providerName = "Globe", priceCentavos = 10900, origin?: "COLLECTED" | "MANUAL") => ({
    promo: { name, priceCentavos },
    providerName,
    origin,
  });

  it("adds the provider only when both names match", () => {
    expect(displayNames(named("GoSURF50"), named("GoSURF50", "TM"))).toEqual(["GoSURF50 (Globe)", "GoSURF50 (TM)"]);
    expect(displayNames(named("GoSURF50"), named("Other", "DITO"))).toEqual(["GoSURF50", "Other"]);
  });

  it("tells apart same-name promos from one provider by price, then by source", () => {
    expect(displayNames(named("Go+109"), named("Go+109", "Globe", 11900))).toEqual(["Go+109 (₱109)", "Go+109 (₱119)"]);
    expect(displayNames(named("Go+109", "Globe", 10900, "COLLECTED"), named("Go+109", "Globe", 10900, "MANUAL"))).toEqual([
      "Go+109 (checked automatically)",
      "Go+109 (checked manually)",
    ]);
  });

  it("never returns the same name twice", () => {
    const [a, b] = displayNames(named("Go+109"), named("Go+109"));
    expect(a).not.toBe(b);
  });
});

describe("summarizeDifferences", () => {
  it("groups what each promo does better into one line", () => {
    const a = entry("A", { priceCentavos: 7000, dataGb: 8, validityValue: 7 });
    const b = entry("B", { priceCentavos: 9900, dataGb: 12.5, validityValue: 30, compatibility: "FIVE_G" });
    expect(summarizeDifferences(a, b)).toEqual([
      { kind: "ahead", name: "A", text: "₱29 cheaper" },
      { kind: "ahead", name: "B", text: "4.50 GB more all-access data, 23 days longer and more data per peso" },
      { kind: "different", text: "Different 4G/5G support: A 4G and 5G; B 5G only" },
    ]);
  });

  it("puts every matching field on one line", () => {
    expect(summarizeDifferences(entry("A"), entry("B"))).toEqual([
      { kind: "same", text: "Same price, all-access data, validity, data per peso and 4G/5G support" },
    ]);
  });

  it("names what can't be compared instead of treating it as zero", () => {
    const a = entry("A", { dataKind: "UNKNOWN", dataGb: undefined });
    const lines = summarizeDifferences(a, entry("B"));
    expect(lines).toContainEqual({ kind: "unknown", text: "Can’t compare data and data per peso: not published for A" });
    expect(lines).toContainEqual({ kind: "same", text: "Same price, validity and 4G/5G support" });
  });

  it("counts unlimited data and no expiry as ahead", () => {
    const a = entry("A", {
      dataKind: "UNLIMITED",
      dataGb: undefined,
      noExpiry: true,
      validityValue: undefined,
      validityUnit: undefined,
    });
    expect(summarizeDifferences(a, entry("B"))[0]).toEqual({
      kind: "ahead",
      name: "A",
      text: "unlimited data and no expiry",
    });
  });
});
