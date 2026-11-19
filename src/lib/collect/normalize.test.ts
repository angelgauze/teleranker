import { describe, expect, it } from "vitest";
import {
  collapseWhitespace,
  parseDataAllocation,
  parsePriceToCentavos,
  parseValidity,
  slugify,
} from "./normalize";

describe("parsePriceToCentavos", () => {
  it("reads a peso sign, PHP prefix and bare P", () => {
    expect(parsePriceToCentavos("₱99")).toBe(9900);
    expect(parsePriceToCentavos("PHP 99")).toBe(9900);
    expect(parsePriceToCentavos("P99")).toBe(9900);
  });

  it("handles thousands separators and centavos", () => {
    expect(parsePriceToCentavos("₱1,299.50")).toBe(129950);
    expect(parsePriceToCentavos("₱ 1,299")).toBe(129900);
  });

  it("returns null when there is no price", () => {
    expect(parsePriceToCentavos("Free")).toBeNull();
    expect(parsePriceToCentavos("")).toBeNull();
    expect(parsePriceToCentavos("Valid for 7 days")).toBeNull();
  });
});

describe("parseDataAllocation", () => {
  it("reads GB allocations", () => {
    expect(parseDataAllocation("20 GB Data")).toMatchObject({ kind: "TOTAL", gb: 20 });
    expect(parseDataAllocation("1.5GB")).toMatchObject({ kind: "TOTAL", gb: 1.5 });
  });

  it("converts MB and TB to GB", () => {
    expect(parseDataAllocation("500MB")).toMatchObject({ kind: "TOTAL", gb: 0.49 });
    expect(parseDataAllocation("2 TB")).toMatchObject({ kind: "TOTAL", gb: 2048 });
  });

  it("recognises unlimited allowances", () => {
    expect(parseDataAllocation("Unlimited 5G")).toMatchObject({ kind: "UNLIMITED" });
    expect(parseDataAllocation("Unli data")).toMatchObject({ kind: "UNLIMITED" });
    expect(parseDataAllocation("Unlimited 5G")).not.toHaveProperty("gb");
  });

  it("returns null for text without a data size", () => {
    expect(parseDataAllocation("DATA ALLOCATION")).toBeNull();
    expect(parseDataAllocation("0 GB")).toBeNull();
  });
});

describe("parseValidity", () => {
  it("parses days, weeks and months", () => {
    expect(parseValidity("Valid for 7 days")).toMatchObject({ value: 7, unit: "DAY" });
    expect(parseValidity("30 Days")).toMatchObject({ value: 30, unit: "DAY" });
    expect(parseValidity("2 weeks")).toMatchObject({ value: 2, unit: "WEEK" });
    expect(parseValidity("1 month")).toMatchObject({ value: 1, unit: "MONTH" });
  });

  it("returns null for zero or missing validity", () => {
    expect(parseValidity("Valid for 0 days")).toBeNull();
    expect(parseValidity("Subscribe Now")).toBeNull();
  });
});

describe("slugify and whitespace", () => {
  it("builds stable keys", () => {
    expect(slugify("DATA MAXX 70")).toBe("data-maxx-70");
    expect(slugify("Go+99")).toBe("go-99");
    expect(slugify("UNLI5G MAXX 99")).toBe("unli5g-maxx-99");
  });

  it("collapses non-breaking spaces and runs of whitespace", () => {
    expect(collapseWhitespace("20\u00a0GB   Data\n")).toBe("20 GB Data");
  });
});
