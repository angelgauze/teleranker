import { describe, expect, it } from "vitest";
import { computeValueMetrics, type ScoredPromo } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { allAccessLead, dataPerDayLead, priceLead, pricePerDayLead, valueLead } from "./emphasis";

function entry(overrides: Partial<PromoInput> = {}): ScoredPromo {
  const promo: PromoInput = {
    providerId: "dito",
    name: "Fixture promo",
    priceCentavos: 9900,
    dataKind: "TOTAL",
    dataGb: 10,
    validityValue: 7,
    validityUnit: "DAY",
    compatibility: "FOUR_G_AND_FIVE_G",
    status: "ACTIVE",
    ...overrides,
  };
  return { promo, metrics: computeValueMetrics(promo) };
}

describe("priceLead", () => {
  it("tags the cheaper promo with the gap", () => {
    expect(priceLead(entry({ priceCentavos: 9900 }), entry({ priceCentavos: 7000 }))).toEqual({
      index: 1,
      tag: "₱29 less",
    });
  });

  it("gives no tag for equal or zero prices", () => {
    expect(priceLead(entry(), entry())).toBeNull();
    expect(priceLead(entry({ priceCentavos: 0 }), entry())).toBeNull();
  });
});

describe("allAccessLead", () => {
  it("tags the promo with more all-access data, ignoring app-only data", () => {
    const split = entry({ dataGb: 20, allAccessGb: 8 });
    expect(allAccessLead(split, entry({ dataGb: 10 }))).toEqual({ index: 1, tag: "2 GB more" });
  });

  it("never compares unlimited or unknown data", () => {
    const unlimited = entry({ dataKind: "UNLIMITED", dataGb: undefined });
    const unknown = entry({ dataKind: "UNKNOWN", dataGb: undefined });
    expect(allAccessLead(unlimited, entry())).toBeNull();
    expect(allAccessLead(entry(), unknown)).toBeNull();
  });

  it("gives no tag for equal data", () => {
    expect(allAccessLead(entry(), entry())).toBeNull();
  });
});

describe("valueLead", () => {
  it("tags the promo with more GB per ₱100", () => {
    expect(valueLead(entry({ dataGb: 12.5 }), entry())).toEqual({ index: 0, tag: "2.53 more" });
  });

  it("gives no tag when either promo is not scored", () => {
    expect(valueLead(entry({ dataKind: "UNLIMITED", dataGb: undefined }), entry())).toBeNull();
    expect(valueLead(entry({ validityValue: undefined, validityUnit: undefined }), entry())).toBeNull();
  });
});

describe("per-day leads", () => {
  it("bands the lower price per day and the higher data per day, without a tag", () => {
    const week = entry({ priceCentavos: 7000, dataGb: 10, validityValue: 7 });
    const fortnight = entry({ priceCentavos: 14900, dataGb: 20, validityValue: 15 });
    expect(pricePerDayLead(week, fortnight)).toEqual({ index: 1 });
    expect(dataPerDayLead(week, fortnight)).toEqual({ index: 0 });
  });

  it("gives nothing when a promo has no per-day figure", () => {
    const noExpiry = entry({ validityValue: undefined, validityUnit: undefined, noExpiry: true });
    expect(pricePerDayLead(noExpiry, entry())).toBeNull();
    expect(dataPerDayLead(entry(), noExpiry)).toBeNull();
  });
});
