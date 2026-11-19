import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLOBE_PROMO_URL, parseGlobePromos } from "./globe";

const fixture = readFileSync(new URL("./fixtures/globe-prepaid-promos.html", import.meta.url), "utf8");

describe("parseGlobePromos", () => {
  const result = parseGlobePromos(fixture);

  it("parses every mobile promo card", () => {
    expect(result.drafts).toHaveLength(7);
  });

  it("skips satellite-only promos with an explicit warning", () => {
    expect(result.drafts.some((promo) => /starlink/i.test(promo.name))).toBe(false);
    expect(result.warnings.filter((warning) => /starlink/i.test(warning))).toHaveLength(2);
  });

  it("reads the headline total, all-access data, price and validity", () => {
    const go99 = result.drafts.find((promo) => promo.name === "Go+99");
    expect(go99).toBeDefined();
    expect(go99).toMatchObject({
      externalKey: "go-99",
      priceCentavos: 9900,
      dataKind: "TOTAL",
      dataGb: 20,
      allAccessGb: 8,
      validityValue: 7,
      validityUnit: "DAY",
      textsUnlimited: true,
    });
  });

  it("keeps inclusions in notes for traceability", () => {
    const go99 = result.drafts.find((promo) => promo.name === "Go+99");
    expect(go99?.dataNotes).toContain("FREE 4 GB for 5G");
    expect(go99?.dataNotes).toContain("8 GB for Choice of Apps");
  });

  it("does not guess 4G/5G compatibility", () => {
    expect(result.drafts.every((promo) => promo.compatibility === undefined)).toBe(true);
  });

  it("produces unique stable keys", () => {
    const keys = result.drafts.map((promo) => promo.externalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("records the source URL it was collected from", () => {
    expect(GLOBE_PROMO_URL).toBe("https://www.globe.com.ph/prepaid/promos");
    expect(parseGlobePromos(fixture).drafts.length).toBe(7);
  });
});
