import { describe, expect, it } from "vitest";
import { computeValueMetrics, type ScoredPromo } from "../ranking/value";
import type { PromoInput } from "../schema/promo";
import { rankPlans } from "./rank";

function entry(name: string, overrides: Partial<PromoInput> = {}): ScoredPromo {
  const promo: PromoInput = {
    providerId: "dito",
    name,
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

const names = (list: Array<{ entry: ScoredPromo }>) => list.map(({ entry }) => entry.promo.name);

describe("rankPlans", () => {
  it("orders by total cost for the days, counting repeat buys", () => {
    const weekly = entry("Weekly 70", { priceCentavos: 7000, validityValue: 7 });
    const monthly = entry("Monthly 299", { priceCentavos: 29900, validityValue: 30 });
    const { ranked } = rankPlans([weekly, monthly], { days: 30 }, { fourGOnly: false });
    // Weekly: 5 buys × ₱70 = ₱350; monthly: 1 × ₱299.
    expect(names(ranked)).toEqual(["Monthly 299", "Weekly 70"]);
    expect(ranked[1].plan).toMatchObject({ buys: 5, totalCentavos: 35000 });
  });

  it("puts promos within the budget first", () => {
    const cheap = entry("Cheap", { priceCentavos: 5000, validityValue: 30 });
    const pricey = entry("Pricey", { priceCentavos: 9000, validityValue: 30 });
    const { ranked } = rankPlans([pricey, cheap], { days: 30, budgetPhp: 60 }, { fourGOnly: false });
    expect(names(ranked)).toEqual(["Cheap", "Pricey"]);
    expect(ranked[1].plan.fitsBudget).toBe(false);
  });

  it("keeps promos it can't calculate apart, with the reason, never as cheap", () => {
    const unknown = entry("No validity", { priceCentavos: 100, validityValue: undefined, validityUnit: undefined });
    const { ranked, cannot } = rankPlans([unknown, entry("Known")], { days: 7 }, { fourGOnly: false });
    expect(names(ranked)).toEqual(["Known"]);
    expect(cannot).toEqual([{ entry: unknown, reason: "its validity is unknown" }]);
  });

  it("leaves out promos without data, and 5G-only promos for a 4G-only phone", () => {
    const callsOnly = entry("Calls only", { dataKind: "NONE", dataGb: undefined });
    const fiveG = entry("5G only", { compatibility: "FIVE_G" });
    const unverified = entry("Unverified", { compatibility: "UNKNOWN" });
    const result = rankPlans([callsOnly, fiveG, unverified], { days: 7 }, { fourGOnly: true });
    expect(names(result.ranked)).toEqual(["Unverified"]);
    expect(result.leftOut).toEqual({ noData: 1, needs5G: 1 });
  });

  it("breaks cost ties by fewer buys, then more data", () => {
    const twoBuys = entry("Two buys", { priceCentavos: 5000, validityValue: 7, dataGb: 5 });
    const oneBuy = entry("One buy", { priceCentavos: 10000, validityValue: 14, dataGb: 5 });
    const bigger = entry("Bigger", { priceCentavos: 10000, validityValue: 14, dataGb: 20 });
    const { ranked } = rankPlans([twoBuys, oneBuy, bigger], { days: 14 }, { fourGOnly: false });
    expect(names(ranked)).toEqual(["Bigger", "One buy", "Two buys"]);
  });
});
