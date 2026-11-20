import { describe, expect, it } from "vitest";
import { promoInputSchema, type PromoInput } from "./promo";

const basePromo: PromoInput = {
  providerId: "globe",
  name: "Fixture Promo (labelled sample data)",
  priceCentavos: 9900,
  dataKind: "TOTAL",
  dataGb: 8,
  validityValue: 7,
  validityUnit: "DAY",
  compatibility: "FOUR_G",
  status: "ACTIVE",
};

function issuePaths(input: unknown): string[] {
  const result = promoInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("promoInputSchema", () => {
  it("accepts a well-formed total-data promo", () => {
    expect(promoInputSchema.safeParse(basePromo).success).toBe(true);
  });

  it("accepts an unlimited promo without a data allowance", () => {
    const { dataGb: _dataGb, ...rest } = basePromo;
    expect(
      promoInputSchema.safeParse({ ...rest, dataKind: "UNLIMITED" }).success,
    ).toBe(true);
  });

  it("accepts a promo whose validity is unknown", () => {
    const { validityValue: _value, validityUnit: _unit, ...rest } = basePromo;
    expect(promoInputSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a total-data promo without dataGb", () => {
    const { dataGb: _dataGb, ...rest } = basePromo;
    expect(issuePaths(rest)).toContain("dataGb");
  });

  it("rejects dataGb on a non-total promo", () => {
    expect(issuePaths({ ...basePromo, dataKind: "UNLIMITED" })).toContain("dataGb");
  });

  it("rejects a validity value without a unit and vice versa", () => {
    const { validityUnit: _unit, ...withoutUnit } = basePromo;
    expect(issuePaths(withoutUnit)).toContain("validityUnit");

    const { validityValue: _value, ...withoutValue } = basePromo;
    expect(issuePaths(withoutValue)).toContain("validityUnit");
  });

  it("rejects zero-day validity but accepts an unknown one", () => {
    expect(issuePaths({ ...basePromo, validityValue: 0 })).toContain("validityValue");
  });

  it("rejects fractional or negative prices", () => {
    expect(issuePaths({ ...basePromo, priceCentavos: 99.5 })).toContain("priceCentavos");
    expect(issuePaths({ ...basePromo, priceCentavos: -1 })).toContain("priceCentavos");
  });

  it("rejects an unrecognised compatibility value", () => {
    expect(issuePaths({ ...basePromo, compatibility: "5G" })).toContain("compatibility");
  });

  it("keeps unknown compatibility as an explicit state", () => {
    expect(
      promoInputSchema.safeParse({ ...basePromo, compatibility: "UNKNOWN" }).success,
    ).toBe(true);
  });

  it("rejects a call count when calls are marked unlimited", () => {
    expect(
      issuePaths({ ...basePromo, callsUnlimited: true, callsIncluded: 100 }),
    ).toContain("callsIncluded");
  });

  it("rejects a non-URL source link", () => {
    expect(issuePaths({ ...basePromo, sourceUrl: "not a url" })).toContain("sourceUrl");
  });

  it("accepts a no-expiry promo without a validity period", () => {
    const { validityValue: _value, validityUnit: _unit, ...rest } = basePromo;
    expect(promoInputSchema.safeParse({ ...rest, noExpiry: true }).success).toBe(true);
  });

  it("rejects a no-expiry promo that also has a validity period", () => {
    expect(issuePaths({ ...basePromo, noExpiry: true })).toContain("noExpiry");
  });
});
