import type { PromoStatus } from "./schema/promo";

/**
 * When a promo counts as outdated (team decision, 2026-11-20; AGENTS.md §14).
 *
 * A promo that nobody has re-verified for more than 14 days is shown as
 * OUTDATED: it may still be on sale, but its details could be stale. With
 * weekly collection runs, 14 days means two missed runs in a row. The same
 * rule applies to every provider, whether its promos are collected or entered
 * by hand, so hand-entered sheets need re-checking at least every two weeks.
 *
 * This is computed when a page is rendered; stored data is not changed.
 * A stored OUTDATED or UNAVAILABLE status always wins.
 */
export const OUTDATED_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

export function effectiveStatus(
  stored: PromoStatus,
  lastVerifiedAt: Date | undefined,
  now: Date,
): PromoStatus {
  if (stored !== "ACTIVE") return stored;
  // Without a verification date nothing shows the promo is current.
  if (!lastVerifiedAt) return "OUTDATED";
  return now.getTime() - lastVerifiedAt.getTime() > OUTDATED_AFTER_DAYS * DAY_MS
    ? "OUTDATED"
    : "ACTIVE";
}
