import type { PromoInput } from "../schema/promo";
import type { RunReport } from "../collect/types";
import type {
  PromoRepository,
  ProviderSeed,
  PublishSummary,
} from "./repository";

/** In-memory repository used by tests and local dry runs. */
export class MemoryPromoRepository implements PromoRepository {
  readonly providers = new Map<string, ProviderSeed>();
  readonly published = new Map<string, Map<string, PromoInput>>();
  readonly runs: RunReport[] = [];

  async ensureProvider(provider: ProviderSeed): Promise<void> {
    this.providers.set(provider.id, provider);
  }

  async countPublished(providerId: string): Promise<number> {
    return this.published.get(providerId)?.size ?? 0;
  }

  async publishPromos(providerId: string, promos: PromoInput[]): Promise<PublishSummary> {
    const next = new Map<string, PromoInput>();
    for (const promo of promos) {
      if (!promo.externalKey) throw new Error("every published promo needs a stable externalKey");
      next.set(promo.externalKey, promo);
    }

    const previous = this.published.get(providerId) ?? new Map<string, PromoInput>();
    let markedUnavailable = 0;
    for (const key of previous.keys()) {
      if (!next.has(key)) markedUnavailable += 1;
    }

    this.published.set(providerId, next);
    return { published: next.size, markedUnavailable };
  }

  async recordRun(report: RunReport): Promise<void> {
    this.runs.push(report);
  }
}
