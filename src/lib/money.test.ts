import { describe, expect, it } from "vitest";
import { MAX_BUDGET_CENTAVOS, parseBudget, parseBudgetRange, parsePesoAmount } from "./money";
import { formatPeso } from "./ui/format";

describe("parsePesoAmount", () => {
  it("accepts every common way of writing the same amount", () => {
    for (const text of ["1299", "1299.00", "1,299", "1,299.00", "₱1,299", "PHP 1,299.00", "p1299", " 1,299 "]) {
      expect(parsePesoAmount(text), text).toBe(129900);
    }
  });

  it("reads small, large and fractional amounts exactly", () => {
    expect(parsePesoAmount("5")).toBe(500);
    expect(parsePesoAmount("99.5")).toBe(9950);
    expect(parsePesoAmount("99.05")).toBe(9905);
    expect(parsePesoAmount("0.10")).toBe(10);
    expect(parsePesoAmount("3,499.00")).toBe(349900);
    expect(parsePesoAmount("12,345,678.90")).toBe(1234567890);
  });

  it("rejects anything that is not a single, well-formed amount", () => {
    for (const text of ["", "free", "-99", "1,29", "12,34.00", "1.999", "99 pesos", "₱99/7 days", "1 299"]) {
      expect(parsePesoAmount(text), text).toBeNull();
    }
  });
});

describe("formatPeso", () => {
  it("groups thousands and shows centavos only when there are some", () => {
    expect(formatPeso(500)).toBe("₱5");
    expect(formatPeso(9900)).toBe("₱99");
    expect(formatPeso(9950)).toBe("₱99.50");
    expect(formatPeso(129900)).toBe("₱1,299");
    expect(formatPeso(129950)).toBe("₱1,299.50");
    expect(formatPeso(1234567890)).toBe("₱12,345,678.90");
  });

  it("round-trips with parsePesoAmount", () => {
    for (const centavos of [500, 9950, 129900, 349999, 1234567890]) {
      expect(parsePesoAmount(formatPeso(centavos))).toBe(centavos);
    }
  });
});

describe("parseBudget / parseBudgetRange", () => {
  it("accepts the same formats as the import", () => {
    for (const text of ["1299", "1,299", "₱1,299", "PHP 1,299.00", " 1299.0 "]) {
      expect(parseBudget(text, "Max budget")).toEqual({ ok: true, centavos: 129900 });
    }
  });

  it("treats blank as no limit", () => {
    expect(parseBudget(undefined, "Min budget")).toEqual({ ok: true });
    expect(parseBudget("  ", "Min budget")).toEqual({ ok: true });
  });

  it("rejects unreadable values and values above ₱1,000,000", () => {
    expect(parseBudget("₱1,000,000", "Max budget")).toEqual({ ok: true, centavos: MAX_BUDGET_CENTAVOS });
    for (const text of ["1,000,000.01", "30000000", "abc", "-5", "1,29"]) {
      expect(parseBudget(text, "Max budget")).toEqual({
        ok: false,
        error: "Max budget must be a peso amount up to ₱1,000,000.",
      });
    }
  });

  it("ignores a rejected field and explains it", () => {
    expect(parseBudgetRange("50", "30000000")).toEqual({
      minCentavos: 5000,
      maxCentavos: undefined,
      errors: ["Max budget must be a peso amount up to ₱1,000,000."],
      invalid: { min: false, max: true },
    });
  });

  it("drops both bounds with a note when min is above max", () => {
    expect(parseBudgetRange("500", "100")).toEqual({
      errors: ["Min budget is higher than max budget, so no budget limit was applied."],
      invalid: { min: true, max: true },
    });
    expect(parseBudgetRange("100", "100")).toMatchObject({
      minCentavos: 10000,
      maxCentavos: 10000,
      errors: [],
    });
  });
});
