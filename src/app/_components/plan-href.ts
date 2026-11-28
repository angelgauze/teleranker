/** The Plan page's inputs as they appear in its address. */
export interface PlanValues {
  days: string;
  daily: string;
  budget: string;
  fourGOnly: boolean;
  /** Provider ids; none means every provider. Ignored while planning for a pair. */
  providers: string[];
}

/** Days used when the address names none. */
export const DEFAULT_DAYS = "30";

/**
 * Plan's address. With `ids` the plan is for that pair; `allPromos` plans for
 * every promo but keeps the pair, so "These two" can be chosen again.
 */
export function planHref(values: PlanValues, ids: readonly string[], allPromos = false): string {
  const params = new URLSearchParams();
  for (const id of ids) params.append("id", id);
  if (ids.length > 0 && allPromos) params.set("promos", "all");
  if (ids.length === 0 || allPromos) for (const provider of values.providers) params.append("provider", provider);
  if (values.days.trim()) params.set("days", values.days.trim());
  if (values.daily.trim()) params.set("daily", values.daily.trim());
  if (values.budget.trim()) params.set("budget", values.budget.trim());
  if (values.fourGOnly) params.set("phone", "4g");
  const query = params.toString();
  return query ? `/plan?${query}` : "/plan";
}
