import { describe, expect, it } from "vitest";
import { topValue, valueBarPercent } from "./value-bar";

describe("valueBarPercent", () => {
  it("is the share of the top value, rounded", () => {
    expect(valueBarPercent(14.29, 14.29)).toBe(100);
    expect(valueBarPercent(10.1, 14.29)).toBe(71);
  });

  it("never gives an unscored promo a bar", () => {
    expect(valueBarPercent(null, 14.29)).toBeNull();
    expect(valueBarPercent(5, null)).toBeNull();
    expect(valueBarPercent(5, 0)).toBeNull();
  });

  it("keeps a small scored value visible and caps at 100", () => {
    expect(valueBarPercent(0.01, 14.29)).toBe(2);
    expect(valueBarPercent(20, 14.29)).toBe(100);
  });
});

describe("topValue", () => {
  it("ignores unscored promos", () => {
    expect(topValue([null, 3, 14.29, null])).toBe(14.29);
  });

  it("is null when nothing is scored", () => {
    expect(topValue([null, null])).toBeNull();
    expect(topValue([])).toBeNull();
  });
});
