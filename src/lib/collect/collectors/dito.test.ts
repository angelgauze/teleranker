import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDitoPromos } from "./dito";

const fixture = readFileSync(new URL("./fixtures/dito-prepaid.html", import.meta.url), "utf8");

describe("parseDitoPromos", () => {
  const result = parseDitoPromos(fixture);

  it("parses every card that publishes a price and validity", () => {
    expect(result.drafts).toHaveLength(36);
  });

  it("skips cards without a price instead of inventing one", () => {
    for (const name of ["PLAY IT", "LIVE IT", "WORK IT"]) {
      expect(result.drafts.some((promo) => promo.name === name)).toBe(false);
      expect(
        result.warnings.some((warning) => new RegExp(`${name}.*no price`, "i").test(warning)),
      ).toBe(true);
    }
  });

  it("reads name, allowance, price, validity and inclusions", () => {
    const maxx70 = result.drafts.find((promo) => promo.name === "DATA MAXX 70");
    expect(maxx70).toMatchObject({
      externalKey: "data-maxx-70",
      priceCentavos: 7000,
      dataKind: "TOTAL",
      dataGb: 10,
      allAccessGb: 10,
      validityValue: 7,
      validityUnit: "DAY",
      callsUnlimited: true,
      textsUnlimited: true,
    });
  });

  it("keeps unlimited plans unscored rather than inventing a GB figure", () => {
    const unli = result.drafts.find((promo) => promo.name === "UNLI5G MAXX 99");
    expect(unli).toMatchObject({ dataKind: "UNLIMITED", priceCentavos: 9900 });
    expect(unli).not.toHaveProperty("dataGb");
    expect(unli?.dataNotes).toMatch(/5GB/i);
  });

  it("separates app-specific data from all-access data", () => {
    const socials = result.drafts.find((promo) => promo.name === "LEVEL-UPSOCIALS 20");
    expect(socials).toMatchObject({
      dataKind: "TOTAL",
      dataGb: 2.5,
      allAccessGb: 0.5,
      validityValue: 1,
    });
  });

  it("does not treat a capped call allowance as unlimited", () => {
    const levelUp = result.drafts.find((promo) => promo.name === "LEVEL-UP 499");
    expect(levelUp?.callsUnlimited).toBeUndefined();
  });

  it("produces unique stable keys", () => {
    const keys = result.drafts.map((promo) => promo.externalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
