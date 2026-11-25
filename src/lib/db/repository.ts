import type { PromoInput, PromoOrigin } from "../schema/promo";
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

export interface PromoRepository {
  /** Creates or updates the provider row that promos and runs reference. */
  ensureProvider(provider: ProviderSeed): Promise<void>;

  /**
   * Size of the currently published (ACTIVE) set from one origin. Collector
   * runs pass "COLLECTED" so the drop guard compares a run only with what an
   * earlier run published, never with a manually imported set.
   */
  countPublished(providerId: string, origin: PromoOrigin): Promise<number>;

  /**
   * Records accepted by the provider's most recent successful, published
   * collection run, or 0 when there has never been one. The drop guard
   * compares a new run against this, so a manual import (which records no
   * run) can neither block a recovered collector nor switch the guard off.
   */
  lastPublishedRunCount(providerId: string): Promise<number>;

  /**
   * Replaces the published set for a provider, whatever its origin.
   *
   * Promos in the new set are inserted or updated with the given origin;
   * previously ACTIVE promos (of either origin) that are absent from the new
   * set become UNAVAILABLE rather than deleted, so they remain visible as "no
   * longer offered". The most recent publish for a provider therefore wins:
   * a successful collector run supersedes a manual import and vice versa.
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
  publishRun(report: RunReport, promos: PromoInput[]): Promise<PublishSummary>;

  /** Records a run that did not publish. */
  recordRun(report: RunReport): Promise<void>;
}

export function isPromoInput(value: unknown): value is PromoInput {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PromoInput).externalKey === "string" &&
    (value as PromoInput).externalKey!.length > 0
  );
}
