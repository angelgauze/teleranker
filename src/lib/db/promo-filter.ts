import type { Prisma } from "../../generated/prisma/client";
import { sortScored, type ScoredPromo, type SortKey } from "../ranking/value";
import type { PromoCompatibility } from "../schema/promo";

export interface PromoFilter {
  providerId?: string;
  minPriceCentavos?: number;
  maxPriceCentavos?: number;
  /** Matches promos that work on that network generation. */
  compatibility?: PromoCompatibility;
  /**
   * Also list promos that are no longer offered (UNAVAILABLE). Off by default.
   * Outdated promos are always listed, marked and after current ones.
   */
  includeInactive?: boolean;
  /** Matches promo or provider names, ignoring case (see normalizeSearch). */
  search?: string;
  sort: SortKey;
}

/** Longest search kept; anything longer is cut, so a crafted address stays cheap. */
const MAX_SEARCH_LENGTH = 60;

/** Trimmed search text with single spaces, or undefined when blank. */
export function normalizeSearch(raw: string | undefined): string | undefined {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
  return text || undefined;
}

/** A 4G filter also matches dual-network promos, and vice versa. */
export function compatibilityValues(compatibility: PromoCompatibility): PromoCompatibility[] {
  switch (compatibility) {
    case "FOUR_G":
      return ["FOUR_G", "FOUR_G_AND_FIVE_G"];
    case "FIVE_G":
      return ["FIVE_G", "FOUR_G_AND_FIVE_G"];
    default:
      return [compatibility];
  }
}

/** Builds the listing query. Pure, so the filter rules can be unit tested. */
export function buildPromoWhere(filter: PromoFilter): Prisma.PromoWhereInput {
  // Stored ACTIVE promos may still be shown as outdated (src/lib/freshness.ts).
  const where: Prisma.PromoWhereInput = filter.includeInactive
    ? {}
    : { status: { in: ["ACTIVE", "OUTDATED"] } };

  if (filter.providerId) where.providerId = filter.providerId;

  if (filter.minPriceCentavos !== undefined || filter.maxPriceCentavos !== undefined) {
    where.priceCentavos = {
      ...(filter.minPriceCentavos !== undefined ? { gte: filter.minPriceCentavos } : {}),
      ...(filter.maxPriceCentavos !== undefined ? { lte: filter.maxPriceCentavos } : {}),
    };
  }

  if (filter.compatibility) {
    where.compatibility = { in: compatibilityValues(filter.compatibility) };
  }

  if (filter.search) {
    // Prisma parameterises the text, so the search cannot change the query.
    where.OR = [
      { name: { contains: filter.search, mode: "insensitive" } },
      { provider: { name: { contains: filter.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

/**
 * Listing order: current (ACTIVE) promos first, ranked by the chosen sort;
 * then OUTDATED promos; then promos no longer offered. Each group is sorted
 * the same way, and outdated or unavailable promos are never mixed into the
 * ranking of current ones.
 */
export function orderForListing<T extends ScoredPromo>(entries: T[], sort: SortKey): T[] {
  const group = (status: string) => entries.filter((entry) => entry.promo.status === status);
  return [
    ...sortScored(group("ACTIVE"), sort),
    ...sortScored(group("OUTDATED"), sort),
    ...sortScored(group("UNAVAILABLE"), sort),
  ];
}
