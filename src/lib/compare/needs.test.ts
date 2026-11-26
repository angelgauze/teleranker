import { describe, expect, it } from "vitest";
import { computeValueMetrics } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { fourGPhoneSupport, isFourGOnlyPhone, parseNeeds, planForNeeds } from "./needs";

function scored(overrides: Partial<PromoInput> = {}) {
  const promo: PromoInput = {
    providerId: "dito",
    name: "Sample",
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

describe("4G-only phone switch", () => {
  it("reads ?phone=4g only", () => {
    expect(isFourGOnlyPhone({ phone: "4g" })).toBe(true);
    expect(isFourGOnlyPhone({ phone: "5g" })).toBe(false);
    expect(isFourGOnlyPhone({})).toBe(false);
  });

  it("warns for 5G-only and unverified promos only", () => {
    expect(fourGPhoneSupport("FIVE_G")).toBe("Unsupported");
    expect(fourGPhoneSupport("UNKNOWN")).toBe("Not verified");
    expect(fourGPhoneSupport("FOUR_G")).toBe("Supported");
    expect(fourGPhoneSupport("FOUR_G_AND_FIVE_G")).toBe("Supported");
  });
});

describe("parseNeeds", () => {
  it("is empty when nothing was entered", () => {
    expect(parseNeeds({})).toEqual({ state: "none" });
    expect(parseNeeds({ days: " ", daily: "", budget: "" })).toEqual({ state: "none" });
  });

  it("reads days, daily data and budget", () => {
    expect(parseNeeds({ days: "30", daily: "1.5", budget: "500" })).toEqual({
      state: "ok",
      needs: { days: 30, dailyGb: 1.5, budgetPhp: 500 },
    });
    expect(parseNeeds({ days: "7" })).toEqual({ state: "ok", needs: { days: 7 } });
  });

  it("requires days and rejects out-of-range or malformed values", () => {
    expect(parseNeeds({ budget: "500" })).toEqual({ state: "invalid", message: "Enter how many days you need." });
    expect(parseNeeds({ days: "0" })).toMatchObject({ state: "invalid" });
    expect(parseNeeds({ days: "2.5" })).toMatchObject({ state: "invalid" });
    expect(parseNeeds({ days: "abc" })).toMatchObject({ state: "invalid" });
    expect(parseNeeds({ days: "30", daily: "999" })).toMatchObject({
      state: "invalid",
      message: "Daily data must be from 0.1 to 50 GB.",
    });
  });
});

describe("planForNeeds", () => {
  it("rounds buys up to cover every day", () => {
    const plan = planForNeeds(scored(), { days: 30 });
    expect(plan).toMatchObject({ state: "ok", buys: 5, totalCentavos: 49500, totalGb: 50 });
  });

  it("buys more when the daily usage needs more data", () => {
    // 30 days × 2 GB = 60 GB; 10 GB per buy → 6 buys (more than the 5 for days).
    expect(planForNeeds(scored(), { days: 30, dailyGb: 2 })).toMatchObject({ buys: 6, totalGb: 60 });
  });

  it("does not over-buy because of float rounding", () => {
    const plan = planForNeeds(scored({ dataGb: 0.3, validityValue: 30 }), { days: 3, dailyGb: 0.1 });
    expect(plan).toMatchObject({ buys: 1 });
  });

  it("checks the budget", () => {
    expect(planForNeeds(scored(), { days: 7, budgetPhp: 100 })).toMatchObject({ fitsBudget: true, budgetGapCentavos: 100 });
    expect(planForNeeds(scored(), { days: 14, budgetPhp: 100 })).toMatchObject({ fitsBudget: false, budgetGapCentavos: -9800 });
    expect(planForNeeds(scored(), { days: 7 })).toMatchObject({ fitsBudget: null, budgetGapCentavos: null });
  });

  it("buys a no-expiry promo for data only", () => {
    const promo = scored({ noExpiry: true, validityValue: undefined, validityUnit: undefined });
    expect(planForNeeds(promo, { days: 365 })).toMatchObject({ buys: 1 });
    expect(planForNeeds(promo, { days: 10, dailyGb: 3 })).toMatchObject({ buys: 3 });
  });

  it("covers any usage with unlimited data", () => {
    const plan = planForNeeds(scored({ dataKind: "UNLIMITED", dataGb: undefined }), { days: 14, dailyGb: 5 });
    expect(plan).toMatchObject({ state: "ok", buys: 2, totalGb: null, unlimitedData: true });
  });

  it("can't calculate with unknown validity, unknown data or no data", () => {
    expect(planForNeeds(scored({ validityValue: undefined, validityUnit: undefined }), { days: 7 })).toEqual({
      state: "cannot",
      reason: "its validity is unknown",
    });
    expect(planForNeeds(scored({ dataKind: "UNKNOWN", dataGb: undefined }), { days: 7, dailyGb: 1 })).toEqual({
      state: "cannot",
      reason: "its data amount is unknown",
    });
    expect(planForNeeds(scored({ dataKind: "NONE", dataGb: undefined }), { days: 7, dailyGb: 1 })).toEqual({
      state: "cannot",
      reason: "it includes no data",
    });
  });

  it("still plans days for unknown data when no usage was given, without guessing the total", () => {
    expect(planForNeeds(scored({ dataKind: "UNKNOWN", dataGb: undefined }), { days: 14 })).toMatchObject({
      state: "ok",
      buys: 2,
      totalGb: null,
      unlimitedData: false,
    });
  });
});
