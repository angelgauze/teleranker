import type { PromoOverride } from "../schema/override";
import type { PromoCompatibility, PromoInput, PromoOrigin } from "../schema/promo";
import type { RunReport } from "../collect/types";
import type {
  OverrideCandidate,
  OverrideImportSummary,
  OverrideSet,
  PromoRepository,
  ProviderSeed,
  PublishSet,
  PublishSummary,
} from "./repository";

export interface StoredPromo {
  promo: PromoInput;
  origin: PromoOrigin;
}

export interface StoredOverride {
  override: PromoOverride;
  collectedCompatibility: PromoCompatibility | null;
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
  /** Stored overrides per provider, keyed by externalKey. */
  readonly overrides = new Map<string, Map<string, StoredOverride>>();

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

  async publishRun(
    report: RunReport,
    promos: PromoInput[],
    collectedCompatibility?: ReadonlyMap<string, PromoCompatibility>,
  ): Promise<PublishSummary> {
    // All-or-nothing, like the database transaction.
    const snapshot = new Map(this.promos.get(report.providerId) ?? []);
    const overrideSnapshot = new Map(this.overrides.get(report.providerId) ?? []);
    try {
      const summary = await this.publishPromos(report.providerId, promos, "COLLECTED");
      const stored = this.overrides.get(report.providerId);
      for (const [key, compatibility] of collectedCompatibility ?? []) {
        const entry = stored?.get(key);
        if (entry) stored!.set(key, { ...entry, collectedCompatibility: compatibility });
      }
      await this.recordRun(report);
      return summary;
    } catch (error) {
      this.promos.set(report.providerId, snapshot);
      this.overrides.set(report.providerId, overrideSnapshot);
      throw error;
    }
  }

  async recordRun(report: RunReport): Promise<void> {
    this.runs.push(report);
  }

  async listOverrides(providerId: string): Promise<PromoOverride[]> {
    return [...(this.overrides.get(providerId)?.values() ?? [])]
      .map((entry) => entry.override)
      .sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  }

  async listOverrideCandidates(providerId: string): Promise<OverrideCandidate[]> {
    return this.liveCollected(providerId).map(({ promo }) => ({
      externalKey: promo.externalKey!,
      name: promo.name,
      priceCentavos: promo.priceCentavos,
      dataKind: promo.dataKind,
      dataGb: promo.dataGb ?? null,
      validityValue: promo.validityValue ?? null,
      validityUnit: promo.validityUnit ?? null,
      noExpiry: promo.noExpiry ?? false,
      compatibility: promo.compatibility,
      sourceUrl: promo.sourceUrl ?? null,
    }));
  }

  async replaceOverrides(sets: OverrideSet[]): Promise<OverrideImportSummary[]> {
    // All-or-nothing, like the database transaction.
    const promos = new Map([...this.promos].map(([id, stored]) => [id, new Map(stored)]));
    const overrides = new Map([...this.overrides].map(([id, stored]) => [id, new Map(stored)]));
    try {
      return sets.map((set) => this.replaceProviderOverrides(set));
    } catch (error) {
      this.promos.clear();
      for (const [id, stored] of promos) this.promos.set(id, stored);
      this.overrides.clear();
      for (const [id, stored] of overrides) this.overrides.set(id, stored);
      throw error;
    }
  }

  private liveCollected(providerId: string): StoredPromo[] {
    return [...(this.promos.get(providerId)?.values() ?? [])].filter(
      (entry) =>
        entry.origin === "COLLECTED" &&
        (entry.promo.status === "ACTIVE" || entry.promo.status === "OUTDATED") &&
        Boolean(entry.promo.externalKey),
    );
  }

  private setCompatibility(providerId: string, key: string, compatibility: PromoCompatibility): void {
    const stored = this.promos.get(providerId)!;
    const entry = stored.get(key)!;
    stored.set(key, { ...entry, promo: { ...entry.promo, compatibility } });
  }

  private replaceProviderOverrides(set: OverrideSet): OverrideImportSummary {
    const { providerId, overrides } = set;
    const previous = this.overrides.get(providerId) ?? new Map<string, StoredOverride>();
    const live = new Map(
      this.liveCollected(providerId).map(({ promo }) => [promo.externalKey!, promo.compatibility]),
    );

    const next = new Map<string, StoredOverride>();
    const unmatched: string[] = [];
    let applied = 0;
    for (const override of overrides) {
      const liveValue = live.get(override.externalKey);
      next.set(override.externalKey, {
        override,
        collectedCompatibility:
          previous.get(override.externalKey)?.collectedCompatibility ?? liveValue ?? null,
      });
      if (liveValue === undefined) {
        unmatched.push(override.externalKey);
        continue;
      }
      this.setCompatibility(providerId, override.externalKey, override.compatibility);
      applied += 1;
    }

    let restored = 0;
    for (const [key, earlier] of previous) {
      if (next.has(key) || !live.has(key) || earlier.collectedCompatibility === null) continue;
      this.setCompatibility(providerId, key, earlier.collectedCompatibility);
      restored += 1;
    }

    this.overrides.set(providerId, next);
    return { providerId, saved: overrides.length, applied, unmatched, restored };
  }

  /** Test helper: the stored promo for a key, including inactive ones. */
  get(providerId: string, externalKey: string): StoredPromo | undefined {
    return this.promos.get(providerId)?.get(externalKey);
  }
}
