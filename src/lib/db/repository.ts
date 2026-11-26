import type { PromoOverride } from "../schema/override";
import type { PromoCompatibility, PromoInput, PromoOrigin } from "../schema/promo";
import type { RunReport } from "../collect/types";

/**
 * Persistence boundary for published promo data.
 *
 * The collection pipeline never imports Prisma directly: it works against this
 * interface, which keeps the parsers and ranking logic testable without a
 * database and makes the storage layer replaceable.
 */

export interface ProviderSeed {
  id: string;
  name: string;
  websiteUrl: string;
  /**
   * The provider's general public promo page. Shown for promos that have no
   * link of their own, labelled as the general page, not the promo's page.
   */
  promoPageUrl?: string;
}

/** One provider's replacement set, for an all-or-nothing multi-provider publish. */
export interface PublishSet {
  provider: ProviderSeed;
  promos: PromoInput[];
  origin: PromoOrigin;
}

export interface PublishSummary {
  published: number;
  markedUnavailable: number;
}

/** One provider's overrides, replacing all of that provider's stored overrides. */
export interface OverrideSet {
  providerId: string;
  /** May be empty: every override for the provider is then removed. */
  overrides: PromoOverride[];
}

export interface OverrideImportSummary {
  providerId: string;
  /** Overrides stored for the provider after the import. */
  saved: number;
  /** Published promos whose compatibility now comes from an override. */
  applied: number;
  /** Stored overrides with no published promo (renamed or removed by the provider). */
  unmatched: string[];
  /** Published promos returned to the collector's own value because their override was removed. */
  restored: number;
}

/** A published, collected promo as the override template lists it. */
export interface OverrideCandidate {
  externalKey: string;
  name: string;
  priceCentavos: number;
  dataKind: "TOTAL" | "UNLIMITED" | "NONE" | "UNKNOWN";
  dataGb?: number | null;
  validityValue?: number | null;
  validityUnit?: "DAY" | "WEEK" | "MONTH" | null;
  noExpiry?: boolean;
  /** What the site shows now (an override's value when one applies). */
  compatibility: PromoCompatibility;
  sourceUrl?: string | null;
}

export interface PromoRepository {
  /** Creates or updates the provider row that promos and runs reference. */
  ensureProvider(provider: ProviderSeed): Promise<void>;

  /** Size of the currently published (ACTIVE) set from one origin. */
  countPublished(providerId: string, origin: PromoOrigin): Promise<number>;

  /**
   * Records accepted by the provider's most recent successful, published
   * collection run, or 0 when there has never been one. The drop guard
   * compares a new run against this, so a manual import (which records no
   * run) can neither block a recovered collector nor switch the guard off.
   */
  lastPublishedRunCount(providerId: string): Promise<number>;

  /**
   * Replaces a provider's published set from one origin.
   *
   * Promos in the new set are inserted or updated with the given origin;
   * previously ACTIVE promos of the same origin that are absent from the new
   * set become UNAVAILABLE rather than deleted, so they remain visible as "no
   * longer offered". Promos of the other origin are never touched: collected
   * and hand-entered promos are listed side by side (the hand-entered sheet
   * supports the collector, it does not replace it). A key already used by
   * the other origin is refused (see originClash) instead of moving the promo.
   */
  publishPromos(
    providerId: string,
    promos: PromoInput[],
    origin: PromoOrigin,
  ): Promise<PublishSummary>;

  /**
   * Ensures each provider and replaces each provider's set (same rules as
   * publishPromos) in a single transaction: either every set is published or
   * nothing changes for any provider.
   */
  publishMany(sets: PublishSet[]): Promise<Array<{ providerId: string } & PublishSummary>>;

  /**
   * Publishes a collector run's promos (origin COLLECTED, same rules as
   * publishPromos) and records the run in one transaction: either the new set
   * and its run log are both saved, or neither is. A run log can therefore
   * never disagree with what was published.
   */
  publishRun(
    report: RunReport,
    promos: PromoInput[],
    /**
     * The collector's own compatibility for promos that had an override
     * applied, by key. Stored on the overrides (same transaction) so removing
     * an override can restore the collector's value.
     */
    collectedCompatibility?: ReadonlyMap<string, PromoCompatibility>,
  ): Promise<PublishSummary>;

  /** Records a run that did not publish. */
  recordRun(report: RunReport): Promise<void>;

  /** The provider's stored overrides. */
  listOverrides(providerId: string): Promise<PromoOverride[]>;

  /** The provider's published (ACTIVE or OUTDATED) collected promos, for the override template. */
  listOverrideCandidates(providerId: string): Promise<OverrideCandidate[]>;

  /**
   * Replaces each provider's stored overrides and updates its published
   * collected promos to match, all in one transaction: a promo with an
   * override takes the override's value, and a promo whose override was
   * removed returns to the collector's own value.
   */
  replaceOverrides(sets: OverrideSet[]): Promise<OverrideImportSummary[]>;
}

/**
 * Error text when a publish reuses keys the other origin already owns. Sheet
 * promo IDs carry the provider prefix (`dito-data-10`) and collector keys do
 * not (`data-10`), so this only fires on a mistake in the sheet.
 */
export function originClash(providerId: string, keys: string[]): string {
  const shown = keys.slice(0, 5).join(", ") + (keys.length > 5 ? `, +${keys.length - 5} more` : "");
  return `${providerId}: promo IDs already used by the other source (${shown}); give these promos different IDs`;
}

export function isPromoInput(value: unknown): value is PromoInput {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PromoInput).externalKey === "string" &&
    (value as PromoInput).externalKey!.length > 0
  );
}
