import { describe, expect, it } from "vitest";
import { formatPriceRange, summarizeProviderPromos, type SummaryRow } from "./summary";

// Synthetic test rows, not real provider data.
const now = new Date("2026-11-22T12:00:00+08:00");
const day = (date: string) => new Date(`${date}T00:00:00+08:00`);

function row(overrides: Partial<SummaryRow> = {}): SummaryRow {
  return {
    status: "ACTIVE",
    priceCentavos: 5000,
    compatibility: "UNKNOWN",
    lastVerifiedAt: day("2026-11-20"),
    ...overrides,
  };
}

describe("summarizeProviderPromos", () => {
  it("counts current and outdated using the 14-day rule", () => {
    const summary = summarizeProviderPromos(
      [
        row(),
        row({ lastVerifiedAt: day("2026-11-01") }),
        row({ lastVerifiedAt: null }),
        row({ status: "OUTDATED" }),
        row({ status: "UNAVAILABLE" }),
      ],
      now,
    );
    expect(summary.current).toBe(4);
    expect(summary.outdated).toBe(3);
  });

  it("price range ignores ₱0 and no-longer-offered promos", () => {
    const summary = summarizeProviderPromos(
      [
        row({ priceCentavos: 0 }),
        row({ priceCentavos: 1000 }),
        row({ priceCentavos: 99900 }),
        row({ priceCentavos: 500, status: "UNAVAILABLE" }),
      ],
      now,
    );
    expect(summary.minPriceCentavos).toBe(1000);
    expect(summary.maxPriceCentavos).toBe(99900);
    expect(formatPriceRange(summary)).toBe("₱10 – ₱999");
  });

  it("all ₱0 gives no price range", () => {
    const summary = summarizeProviderPromos([row({ priceCentavos: 0 })], now);
    expect(summary.minPriceCentavos).toBeNull();
    expect(summary.maxPriceCentavos).toBeNull();
    expect(formatPriceRange(summary)).toBe("Not available");
  });

  it("one price shows once", () => {
    const summary = summarizeProviderPromos(
      [row({ priceCentavos: 9900 }), row({ priceCentavos: 9900 })],
      now,
    );
    expect(formatPriceRange(summary)).toBe("₱99");
  });

  it("counts compatibility over current promos", () => {
    const summary = summarizeProviderPromos(
      [
        row({ compatibility: "FIVE_G" }),
        row({ compatibility: "FOUR_G_AND_FIVE_G" }),
        row({ compatibility: "FOUR_G_AND_FIVE_G" }),
        row({ compatibility: "UNKNOWN" }),
        row({ compatibility: "FIVE_G", status: "UNAVAILABLE" }),
      ],
      now,
    );
    expect(summary.compatibility).toEqual({
      FIVE_G: 1,
      FOUR_G_AND_FIVE_G: 2,
      FOUR_G: 0,
      UNKNOWN: 1,
    });
  });

  it("empty provider", () => {
    expect(summarizeProviderPromos([], now)).toEqual({
      current: 0,
      outdated: 0,
      minPriceCentavos: null,
      maxPriceCentavos: null,
      compatibility: { FOUR_G: 0, FIVE_G: 0, FOUR_G_AND_FIVE_G: 0, UNKNOWN: 0 },
    });
  });
});
