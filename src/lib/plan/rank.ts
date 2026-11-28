import { planForNeeds, type Needs, type Plan } from "../compare/needs";
import type { ScoredPromo } from "../ranking/value";

/**
 * Plan: every promo costed for the visitor's needs with `planForNeeds`, cheapest
 * first (docs/ranking.md, "Plan"). Promos that can't be costed are kept apart
 * with the reason, never ranked as cheap.
 */

export type OkPlan = Extract<Plan, { state: "ok" }>;

export interface RankedPlan<T> {
  entry: T;
  plan: OkPlan;
}

export interface PlanRanking<T> {
  /** Within budget first (when a budget is given), then lowest total cost. */
  ranked: RankedPlan<T>[];
  /** Promos whose plan can't be calculated, with the reason. */
  cannot: Array<{ entry: T; reason: string }>;
  /** Left out because they don't fit the question at all. */
  leftOut: { noData: number; needs5G: number };
}

/** Lower total first; then fewer buys; then more data (unlimited first); then name. */
function byCost<T extends ScoredPromo>(a: RankedPlan<T>, b: RankedPlan<T>): number {
  const fit = (p: OkPlan) => (p.fitsBudget === false ? 1 : 0);
  return (
    fit(a.plan) - fit(b.plan) ||
    a.plan.totalCentavos - b.plan.totalCentavos ||
    a.plan.buys - b.plan.buys ||
    Number(b.plan.unlimitedData) - Number(a.plan.unlimitedData) ||
    (b.plan.totalGb ?? 0) - (a.plan.totalGb ?? 0) ||
    a.entry.promo.name.localeCompare(b.entry.promo.name)
  );
}

export function rankPlans<T extends ScoredPromo>(
  entries: T[],
  needs: Needs,
  { fourGOnly }: { fourGOnly: boolean },
): PlanRanking<T> {
  const ranked: RankedPlan<T>[] = [];
  const cannot: Array<{ entry: T; reason: string }> = [];
  const leftOut = { noData: 0, needs5G: 0 };

  for (const entry of entries) {
    // Calls-and-texts promos answer a different question than "data for N days".
    if (entry.promo.dataKind === "NONE") {
      leftOut.noData += 1;
      continue;
    }
    // Needs a 5G phone; promos with unverified 4G/5G stay in and are labelled.
    if (fourGOnly && entry.promo.compatibility === "FIVE_G") {
      leftOut.needs5G += 1;
      continue;
    }
    const plan = planForNeeds(entry, needs);
    if (plan.state === "cannot") cannot.push({ entry, reason: plan.reason });
    else ranked.push({ entry, plan });
  }

  ranked.sort(byCost);
  return { ranked, cannot, leftOut };
}
