import type { PromoInput, PromoOrigin } from "../schema/promo";
import type { RunReport } from "../collect/types";
import type {
  PromoRepository,
  ProviderSeed,
  PublishSet,
  PublishSummary,
} from "./repository";

export interface StoredPromo {
  promo: PromoInput;
  origin: PromoOrigin;
}

/**
 * In-memory repository used by tests and local dry runs.
 *
 * Mirrors PrismaPromoRepository: every promo ever published is kept with its
 * status, promos missing from a newer set become UNAVAILABLE instead of being
 * removed, and counts only include ACTIVE promos.
 */
export class MemoryPromoRepository implements PromoRepository {
  readonly providers = new Map<string, ProviderSeed>();
  /** Every stored promo per provider, keyed by externalKey, whatever its status. */
  readonly promos = new Map<string, Map<string, StoredPromo>>();
  readonly runs: RunReport[] = [];

  async ensureProvider(provider: ProviderSeed): Promise<void> {
    this.providers.set(provider.id, provider);
  }

  async countPublished(providerId: string, origin: PromoOrigin): Promise<number> {
    let count = 0;
    for (const entry of this.promos.get(providerId)?.values() ?? []) {
      if (entry.origin === origin && entry.promo.status === "ACTIVE") count += 1;
    }
    return count;
  }

  async lastPublishedRunCount(providerId: string): Promise<number> {
    const latest = this.runs
      .filter((run) => run.providerId === providerId && run.status === "SUCCEEDED" && run.published)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
    return latest?.recordsAccepted ?? 0;
  }

  async publishPromos(
    providerId: string,
    promos: PromoInput[],
    origin: PromoOrigin,
  ): Promise<PublishSummary> {
    const keys = new Set<string>();
    for (const promo of promos) {
      if (!promo.externalKey) throw new Error("every published promo needs a stable externalKey");
      keys.add(promo.externalKey);
    }

    const stored = this.promos.get(providerId) ?? new Map<string, StoredPromo>();
    this.promos.set(providerId, stored);

    let markedUnavailable = 0;
    for (const [key, entry] of stored) {
      if (entry.promo.status === "ACTIVE" && !keys.has(key)) {
        stored.set(key, { ...entry, promo: { ...entry.promo, status: "UNAVAILABLE" } });
        markedUnavailable += 1;
      }
    }

    for (const promo of promos) {
      stored.set(promo.externalKey!, { promo, origin });
    }

    return { published: promos.length, markedUnavailable };
  }

  async publishMany(sets: PublishSet[]): Promise<Array<{ providerId: string } & PublishSummary>> {
    // All-or-nothing, like a database transaction: restore on any failure.
    const providers = new Map(this.providers);
    const promos = new Map([...this.promos].map(([id, stored]) => [id, new Map(stored)]));
    try {
      const results: Array<{ providerId: string } & PublishSummary> = [];
      for (const set of sets) {
        await this.ensureProvider(set.provider);
        const summary = await this.publishPromos(set.provider.id, set.promos, set.origin);
        results.push({ providerId: set.provider.id, ...summary });
      }
      return results;
    } catch (error) {
      this.providers.clear();
      for (const [id, seed] of providers) this.providers.set(id, seed);
      this.promos.clear();
      for (const [id, stored] of promos) this.promos.set(id, stored);
      throw error;
    }
  }

  async publishRun(report: RunReport, promos: PromoInput[]): Promise<PublishSummary> {
    // All-or-nothing, like the database transaction.
    const snapshot = new Map(this.promos.get(report.providerId) ?? []);
    try {
      const summary = await this.publishPromos(report.providerId, promos, "COLLECTED");
      await this.recordRun(report);
      return summary;
    } catch (error) {
      this.promos.set(report.providerId, snapshot);
      throw error;
    }
  }

  async recordRun(report: RunReport): Promise<void> {
    this.runs.push(report);
  }

  /** Test helper: the stored promo for a key, including inactive ones. */
  get(providerId: string, externalKey: string): StoredPromo | undefined {
    return this.promos.get(providerId)?.get(externalKey);
  }
}
