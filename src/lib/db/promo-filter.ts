import type { Prisma } from "../../generated/prisma/client";
import { sortScored, validityToDays, type ScoredPromo, type SortKey } from "../ranking/value";
import type { PromoCompatibility, PromoInput } from "../schema/promo";

/**
 * How long a promo lasts, in the groups the listing filters by. Promos with an
 * unknown validity belong to no group, so they only show when no group is picked.
 */
export const VALIDITY_BANDS = ["1-3", "4-7", "8-30", "31+", "no-expiry"] as const;
export type ValidityBand = (typeof VALIDITY_BANDS)[number];

/** Most providers one filter may name; more is ignored, so a crafted address stays cheap. */
export const MAX_PROVIDER_FILTER = 10;

export interface PromoFilter {
  /** Matches promos from any of these providers (one or several). */
  providerIds?: string[];
  minPriceCentavos?: number;
  maxPriceCentavos?: number;
  /** Matches promos that work on that network generation. */
  compatibility?: PromoCompatibility;
  /** Matches promos whose validity falls in this group. */
  validity?: ValidityBand;
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

/**
 * Phone filter values. "Works on a 4G phone" (FOUR_G) matches every promo an
 * LTE phone can use; "5G phone only" (FIVE_G) matches only promos that need a
 * 5G phone. A 5G phone runs every verified promo, so it needs no option.
 */
export function compatibilityValues(compatibility: PromoCompatibility): PromoCompatibility[] {
  switch (compatibility) {
    case "FOUR_G":
      return ["FOUR_G", "FOUR_G_AND_FIVE_G"];
    default:
      return [compatibility];
  }
}

/** True when a promo passes the 4G/5G filter (always true without one). */
export function matchesCompatibility(compatibility: PromoCompatibility, filter: PromoFilter): boolean {
  return !filter.compatibility || compatibilityValues(filter.compatibility).includes(compatibility);
}

/**
 * Provider ids from the address (`?provider=smart&provider=globe`): trimmed,
 * without blanks or repeats, at most MAX_PROVIDER_FILTER.
 */
export function parseProviderIds(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const ids = values.map((value) => value.trim()).filter((value) => value !== "");
  return [...new Set(ids)].slice(0, MAX_PROVIDER_FILTER);
}

/** The validity group from an address value, or undefined for anything else. */
export function parseValidityBand(raw: string | undefined): ValidityBand | undefined {
  return VALIDITY_BANDS.find((band) => band === raw);
}

/**
 * The group a promo's validity falls in, or null when its validity is unknown.
 * Weeks and months count as 7 and 30 days, as in the ranking.
 */
export function validityBand(
  promo: Pick<PromoInput, "validityValue" | "validityUnit" | "noExpiry">,
): ValidityBand | null {
  if (promo.noExpiry) return "no-expiry";
  const days = validityToDays(promo.validityValue, promo.validityUnit);
  if (days === null) return null;
  if (days <= 3) return "1-3";
  if (days <= 7) return "4-7";
  if (days <= 30) return "8-30";
  return "31+";
}

/** True when a promo passes the validity filter (always true without one). */
export function matchesValidity(
  promo: Pick<PromoInput, "validityValue" | "validityUnit" | "noExpiry">,
  filter: PromoFilter,
): boolean {
  return !filter.validity || validityBand(promo) === filter.validity;
}

/**
 * Builds the listing query. Pure, so the filter rules can be unit tested.
 *
 * The 4G/5G filter is not part of the query: it runs after duplicates are
 * hidden (see loadListing), because the scraped and hand-entered copies of one
 * promo can disagree on 4G/5G. Filtering first would let the hidden copy
 * through. Provider, price and name are what make two rows copies, so those
 * filters are safe in the query.
 */
export function buildPromoWhere(filter: PromoFilter): Prisma.PromoWhereInput {
  // Stored ACTIVE promos may still be shown as outdated (src/lib/freshness.ts).
  const where: Prisma.PromoWhereInput = filter.includeInactive
    ? {}
    : { status: { in: ["ACTIVE", "OUTDATED"] } };

  const providerIds = filter.providerIds ?? [];
  if (providerIds.length === 1) where.providerId = providerIds[0];
  else if (providerIds.length > 1) where.providerId = { in: providerIds };

  if (filter.minPriceCentavos !== undefined || filter.maxPriceCentavos !== undefined) {
    where.priceCentavos = {
      ...(filter.minPriceCentavos !== undefined ? { gte: filter.minPriceCentavos } : {}),
      ...(filter.maxPriceCentavos !== undefined ? { lte: filter.maxPriceCentavos } : {}),
    };
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
