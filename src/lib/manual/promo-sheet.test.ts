import { describe, expect, it } from "vitest";
import type { CsvRecord } from "./csv";
import { checkVerifiedDate, mapSheetRow, parseVerifiedDate } from "./promo-sheet";

// Synthetic rows in the sheet's column format. Not real provider data.
const baseRow: Record<string, string> = {
  promo_id: "fixture-data-99",
  brand_id: "fixture",
  promo_name: "Fixture Data 99",
  price_php: "99.00",
  open_gb: "10",
  app_gb: "0",
  is_unlimited_data: "no",
  validity_days: "7",
  is_no_expiry: "no",
  network_support: "4G",
  calls: "none",
  calls_minutes: "",
  texts: "none",
  source_url: "",
  source_type: "official_web",
  status: "active",
  last_verified_at: "2026-11-19",
  notes: "Fixture row for tests.",
  verified_by: "someone",
  entered_by: "someone",
};

function map(overrides: Record<string, string> = {}) {
  const record: CsvRecord = { line: 2, values: { ...baseRow, ...overrides } };
  return mapSheetRow(record);
}

function promoOf(overrides: Record<string, string> = {}) {
  const result = map(overrides);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.promo;
}

function errorsOf(overrides: Record<string, string>) {
  const result = map(overrides);
  if (result.ok) throw new Error("expected the row to be rejected");
  return result.errors.join("; ");
}

describe("mapSheetRow", () => {
  it("maps a plain data promo", () => {
    const promo = promoOf();
    expect(promo).toMatchObject({
      providerId: "fixture",
      externalKey: "fixture-data-99",
      name: "Fixture Data 99",
      priceCentavos: 9900,
      dataKind: "TOTAL",
      dataGb: 10,
      validityValue: 7,
      validityUnit: "DAY",
      status: "ACTIVE",
      description: "Fixture row for tests.",
      sourceMetadata: { entry: "manual-import", sourceType: "official_web" },
    });
    expect(promo.allAccessGb).toBeUndefined();
    expect(promo.sourceUrl).toBeUndefined();
  });

  it("never stores contributor names", () => {
    expect(JSON.stringify(promoOf())).not.toContain("someone");
  });

  it("uses open data as the all-access figure when app data exists", () => {
    expect(promoOf({ open_gb: "10", app_gb: "7" })).toMatchObject({ dataGb: 17, allAccessGb: 10 });
  });

  it("distinguishes unlimited, none and unknown data", () => {
    expect(promoOf({ is_unlimited_data: "yes", open_gb: "" }).dataKind).toBe("UNLIMITED");
    expect(promoOf({ open_gb: "0", app_gb: "0" }).dataKind).toBe("NONE");
    expect(promoOf({ open_gb: "", app_gb: "" }).dataKind).toBe("UNKNOWN");
  });

  it("rejects contradictory data columns", () => {
    expect(errorsOf({ is_unlimited_data: "yes", open_gb: "5" })).toMatch(/open_gb must be blank/);
    expect(errorsOf({ open_gb: "0", app_gb: "3" })).toMatch(/app-only data/);
  });

  it("maps no-expiry and unknown validity distinctly", () => {
    const noExpiry = promoOf({ is_no_expiry: "yes", validity_days: "" });
    expect(noExpiry.noExpiry).toBe(true);
    expect(noExpiry.validityValue).toBeUndefined();

    const unknown = promoOf({ validity_days: "" });
    expect(unknown.noExpiry).toBeUndefined();
    expect(unknown.validityValue).toBeUndefined();
  });

  it("rejects a no-expiry promo that also has validity days", () => {
    expect(errorsOf({ is_no_expiry: "yes" })).toMatch(/validity_days must be blank/);
  });

  it("maps network support by phone compatibility", () => {
    expect(promoOf({ network_support: "5G" }).compatibility).toBe("FIVE_G");
    expect(promoOf({ network_support: "4G" }).compatibility).toBe("FOUR_G_AND_FIVE_G");
    expect(promoOf({ network_support: "4G/5G" }).compatibility).toBe("FOUR_G_AND_FIVE_G");
    expect(promoOf({ network_support: "" }).compatibility).toBe("UNKNOWN");
    expect(errorsOf({ network_support: "3G" })).toMatch(/network_support/);
  });

  it("maps calls and texts without overstating them", () => {
    expect(promoOf({ calls: "unli_allnet", texts: "unli_allnet" })).toMatchObject({
      callsUnlimited: true,
      textsUnlimited: true,
    });
    expect(promoOf({ calls: "none", texts: "none" })).toMatchObject({
      callsIncluded: 0,
      textsIncluded: 0,
    });
    expect(promoOf({ calls: "limited", calls_minutes: "30", texts: "limited" })).toMatchObject({
      callsUnlimited: false,
      callsIncluded: 30,
      textsUnlimited: false,
    });
    expect(promoOf({ texts: "limited" }).textsIncluded).toBeUndefined();

    const onNet = promoOf({ calls: "unli_onnet", texts: "" });
    expect(onNet.callsUnlimited).toBeUndefined();
    expect(onNet.callsIncluded).toBeUndefined();
    expect(onNet.textsUnlimited).toBeUndefined();
  });

  it("keeps a valid source link and rejects a non-https one", () => {
    expect(promoOf({ source_url: "https://example.test/promos" }).sourceUrl).toBe(
      "https://example.test/promos",
    );
    expect(errorsOf({ source_url: "http://example.test" })).toMatch(/https/);
  });

  it("accepts prices written with thousands separators or a peso sign", () => {
    expect(promoOf({ price_php: "1,299.00" }).priceCentavos).toBe(129900);
    expect(promoOf({ price_php: "₱3,499" }).priceCentavos).toBe(349900);
    expect(promoOf({ price_php: "99.50" }).priceCentavos).toBe(9950);
  });

  it("rejects missing or invalid required values", () => {
    expect(errorsOf({ price_php: "0" })).toMatch(/greater than 0/);
    expect(errorsOf({ price_php: "free" })).toMatch(/peso amount/);
    expect(errorsOf({ price_php: "1,29" })).toMatch(/peso amount/);
    expect(errorsOf({ last_verified_at: "" })).toMatch(/last_verified_at/);
    expect(errorsOf({ status: "gone" })).toMatch(/status/);
    expect(errorsOf({ promo_name: "" })).toMatch(/name/);
  });
});

describe("parseVerifiedDate", () => {
  it("reads ISO dates as midnight in Manila", () => {
    expect(parseVerifiedDate("2026-11-19")?.toISOString()).toBe("2026-11-18T16:00:00.000Z");
  });

  it("reads Excel date serials", () => {
    // Serial 46344 is 2026-11-18.
    expect(parseVerifiedDate("46344")?.toISOString()).toBe("2026-11-17T16:00:00.000Z");
    expect(parseVerifiedDate("46344.0")?.toISOString()).toBe("2026-11-17T16:00:00.000Z");
  });

  it("rejects impossible or unsupported dates", () => {
    expect(parseVerifiedDate("2026-02-30")).toBeUndefined();
    expect(parseVerifiedDate("11/19/2026")).toBeUndefined();
  });
});

describe("checkVerifiedDate", () => {
  // 2026-11-20 10:00 in Manila.
  const now = new Date("2026-11-20T02:00:00Z");
  const check = (raw: string) => checkVerifiedDate(raw, parseVerifiedDate(raw)!, now);

  it("accepts dates up to and including the import day", () => {
    expect(check("2026-11-20")).toBeUndefined();
    expect(check("2020-01-01")).toBeUndefined();
    expect(check("46344")).toBeUndefined();
  });

  it("rejects future dates", () => {
    expect(check("2026-11-21")).toBe("last_verified_at 2026-11-21 is in the future");
    expect(check("2027-11-18")).toBe("last_verified_at 2027-11-18 is in the future");
  });

  it("rejects dates before 2020, showing what a serial number meant", () => {
    expect(check("2019-12-31")).toBe("last_verified_at 2019-12-31 is before 2020-01-01");
    expect(check("10000")).toBe("last_verified_at 10000 (1927-05-18) is before 2020-01-01");
  });

  it("reports the problem on the sheet row", () => {
    const result = mapSheetRow(
      { line: 7, values: { ...baseRow, last_verified_at: "2027-11-18" } },
      now,
    );
    expect(result).toMatchObject({ ok: false, line: 7 });
    expect(!result.ok && result.errors).toContain("last_verified_at 2027-11-18 is in the future");
  });
});
