import { describe, expect, it } from "vitest";
import type { OverrideCandidate } from "../db/repository";
import type { PromoOverride } from "../schema/override";
import { parseCsvRecords } from "./csv";
import {
  buildOverrideTemplate,
  OVERRIDE_TEMPLATE_COLUMNS,
  validateOverrideSheet,
} from "./override-sheet";

// Synthetic test rows, not real provider data.
const overridable = new Set(["alpha", "beta"]);
const now = new Date("2026-11-21T12:00:00+08:00");
const header = OVERRIDE_TEMPLATE_COLUMNS.join(",");

function sheet(...rows: string[]): string {
  return [header, ...rows].join("\r\n");
}

/** provider,promo_id,name,price_php,data,validity,shown_now,network_support,verified_at,source_url,note */
function row(
  values: Partial<Record<(typeof OVERRIDE_TEMPLATE_COLUMNS)[number], string>> = {},
): string {
  const filled = {
    provider: "alpha",
    promo_id: "promo-a",
    name: "Promo A",
    price_php: "70.00",
    data: "7 GB",
    validity: "7 days",
    shown_now: "Not verified",
    network_support: "4G/5G",
    verified_at: "2026-11-20",
    source_url: "https://example.test/promos",
    note: "",
    ...values,
  };
  return OVERRIDE_TEMPLATE_COLUMNS.map((column) => filled[column]).join(",");
}

describe("validateOverrideSheet", () => {
  it("returns the checked values per provider", () => {
    const result = validateOverrideSheet(
      sheet(row(), row({ promo_id: "promo-b", network_support: "5G", note: "checked twice" })),
      overridable,
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].overrides).toEqual([
      {
        providerId: "alpha",
        externalKey: "promo-a",
        compatibility: "FOUR_G_AND_FIVE_G",
        verifiedAt: new Date("2026-11-20T00:00:00+08:00"),
        sourceUrl: "https://example.test/promos",
      },
      {
        providerId: "alpha",
        externalKey: "promo-b",
        compatibility: "FIVE_G",
        verifiedAt: new Date("2026-11-20T00:00:00+08:00"),
        sourceUrl: "https://example.test/promos",
        note: "checked twice",
      },
    ]);
  });

  it("ignores rows left blank but still replaces that provider's overrides", () => {
    const result = validateOverrideSheet(
      sheet(row({ network_support: "", verified_at: "" }), row({ provider: "beta", promo_id: "b-1" })),
      overridable,
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers.map((set) => [set.providerId, set.overrides.length])).toEqual([
      ["alpha", 0],
      ["beta", 1],
    ]);
  });

  it("rejects the whole file when any row is invalid, listing every problem", () => {
    const result = validateOverrideSheet(
      sheet(
        row({ network_support: "LTE" }),
        row({ promo_id: "promo-b", verified_at: "" }),
        row({ promo_id: "promo-c", verified_at: "2026-11-25" }),
        row({ promo_id: "promo-d", source_url: "" }),
        row({ promo_id: "promo-e", source_url: "http://example.test" }),
        row({ promo_id: "" }),
      ),
      overridable,
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const messages = result.rowErrors.map((error) => `${error.line} ${error.errors.join("; ")}`);
    expect(messages).toEqual([
      '2 network_support must be 4G, 4G/5G or 5G (got "LTE")',
      '3 verified_at must be a YYYY-MM-DD date (got "")',
      "4 verified_at 2026-11-25 is in the future",
      "5 source_url is required: the page where the value was checked",
      "6 source_url must start with https://",
      "7 promo_id is required",
    ]);
  });

  it("accepts only automatically collected providers", () => {
    const result = validateOverrideSheet(sheet(row({ provider: "handmade" })), overridable, now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rowErrors[0].errors[0]).toMatch(/provider "handmade" cannot take overrides/);
  });

  it("rejects a promo listed twice for the same provider", () => {
    const result = validateOverrideSheet(sheet(row(), row({ network_support: "5G" })), overridable, now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rowErrors).toEqual([
      { line: 3, promoId: "promo-a", errors: ["duplicate promo_id (first used on line 2)"] },
    ]);
  });

  it("allows the same promo ID under different providers", () => {
    const result = validateOverrideSheet(sheet(row(), row({ provider: "beta" })), overridable, now);
    expect(result.ok).toBe(true);
  });

  it("reports missing columns and empty files", () => {
    const missing = validateOverrideSheet("provider,promo_id\r\nalpha,a", overridable, now);
    expect(missing).toMatchObject({
      ok: false,
      fileErrors: ["missing columns: network_support, verified_at, source_url, note"],
    });
    expect(validateOverrideSheet(header, overridable, now)).toMatchObject({
      ok: false,
      fileErrors: ["the sheet has no rows"],
    });
  });
});

describe("buildOverrideTemplate", () => {
  const candidates: OverrideCandidate[] = [
    {
      externalKey: "big",
      name: "Big, Promo",
      priceCentavos: 29900,
      dataKind: "UNLIMITED",
      compatibility: "UNKNOWN",
      validityValue: 30,
      validityUnit: "DAY",
    },
    {
      externalKey: "small",
      name: "Small Promo",
      priceCentavos: 7000,
      dataKind: "TOTAL",
      dataGb: 7,
      compatibility: "FIVE_G",
      noExpiry: true,
      sourceUrl: "https://example.test/small",
    },
  ];
  const stored: PromoOverride[] = [
    {
      providerId: "alpha",
      externalKey: "small",
      compatibility: "FIVE_G",
      verifiedAt: new Date("2026-11-20T00:00:00+08:00"),
      sourceUrl: "https://example.test/checked",
      note: "on the promo card",
    },
    {
      providerId: "alpha",
      externalKey: "retired",
      compatibility: "FOUR_G_AND_FIVE_G",
      verifiedAt: new Date("2026-11-19T00:00:00+08:00"),
      sourceUrl: "https://example.test/old",
    },
  ];

  const csv = buildOverrideTemplate({
    providerId: "alpha",
    candidates,
    overrides: stored,
    fallbackSourceUrl: "https://example.test/promos",
  });
  const { header: columns, records } = parseCsvRecords(csv);

  it("lists published promos by price with stored values filled in, then retired overrides", () => {
    expect(columns).toEqual([...OVERRIDE_TEMPLATE_COLUMNS]);
    expect(records.map((record) => record.values)).toEqual([
      {
        provider: "alpha",
        promo_id: "small",
        name: "Small Promo",
        price_php: "70.00",
        data: "7 GB",
        validity: "No expiry",
        shown_now: "5G only",
        network_support: "5G",
        verified_at: "2026-11-20",
        source_url: "https://example.test/checked",
        note: "on the promo card",
      },
      {
        provider: "alpha",
        promo_id: "big",
        name: "Big, Promo",
        price_php: "299.00",
        data: "Unlimited",
        validity: "30 days",
        shown_now: "Not verified",
        network_support: "",
        verified_at: "",
        source_url: "https://example.test/promos",
        note: "",
      },
      {
        provider: "alpha",
        promo_id: "retired",
        name: "(no longer published)",
        price_php: "",
        data: "",
        validity: "",
        shown_now: "",
        network_support: "4G/5G",
        verified_at: "2026-11-19",
        source_url: "https://example.test/old",
        note: "",
      },
    ]);
  });

  it("imports back to the same stored values", () => {
    const result = validateOverrideSheet(csv, overridable, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers[0].overrides).toEqual(stored);
  });
});
