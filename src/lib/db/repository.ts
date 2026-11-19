import type { PromoInput } from "../schema/promo";
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
}

export interface PublishSummary {
  published: number;
  markedUnavailable: number;
}

export interface PromoRepository {
  /** Creates or updates the provider row that promos and runs reference. */
  ensureProvider(provider: ProviderSeed): Promise<void>;

  /** Size of the currently published (ACTIVE) set for the drop guard. */
  countPublished(providerId: string): Promise<number>;

  /**
   * Replaces the published set for a provider.
   *
   * Promos in the new set are inserted or updated; previously ACTIVE promos
   * that are absent from the new set become UNAVAILABLE rather than deleted,
   * so they remain visible as "no longer offered".
   */
  publishPromos(providerId: string, promos: PromoInput[]): Promise<PublishSummary>;

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
