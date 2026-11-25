import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { PromoInput, PromoOrigin } from "../schema/promo";
import type { RunReport } from "../collect/types";
import type {
  PromoRepository,
  ProviderSeed,
  PublishSet,
  PublishSummary,
} from "./repository";

type Tx = Prisma.TransactionClient;

function upsertProvider(db: Tx | PrismaClient, provider: ProviderSeed) {
  const data = {
    name: provider.name,
    websiteUrl: provider.websiteUrl,
    promoPageUrl: provider.promoPageUrl ?? null,
  };
  return db.provider.upsert({
    where: { id: provider.id },
    create: { id: provider.id, ...data },
    update: data,
  });
}

function keysOf(promos: PromoInput[]): string[] {
  const keys = promos.map((promo) => promo.externalKey).filter((key): key is string => Boolean(key));
  if (keys.length !== promos.length) {
    throw new Error("every published promo needs a stable externalKey");
  }
  return keys;
}

/**
 * Replaces one provider's active set inside an open transaction. Shared by
 * publishPromos (one provider) and publishMany (several, all-or-nothing).
 */
async function replaceSet(
  tx: Tx,
  providerId: string,
  promos: PromoInput[],
  origin: PromoOrigin,
): Promise<PublishSummary> {
  const keys = keysOf(promos);

  const markedUnavailable = await tx.promo.updateMany({
    where: {
      providerId,
      status: "ACTIVE",
      OR: [{ externalKey: null }, { externalKey: { notIn: keys } }],
    },
    data: { status: "UNAVAILABLE" },
  });

  for (const promo of promos) {
    const externalKey = promo.externalKey!;
    const data = { ...toWriteData(promo), origin };
    await tx.promo.upsert({
      where: { providerId_externalKey: { providerId, externalKey } },
      create: { providerId, externalKey, ...data },
      update: data,
    });
  }

  return { published: promos.length, markedUnavailable: markedUnavailable.count };
}

function toWriteData(promo: PromoInput) {
  return {
    name: promo.name,
    description: promo.description ?? null,
    priceCentavos: promo.priceCentavos,
    dataKind: promo.dataKind,
    dataGb: promo.dataGb ?? null,
    allAccessGb: promo.allAccessGb ?? null,
    dataNotes: promo.dataNotes ?? null,
    validityValue: promo.validityValue ?? null,
    validityUnit: promo.validityUnit ?? null,
    noExpiry: promo.noExpiry ?? false,
    compatibility: promo.compatibility,
    callsUnlimited: promo.callsUnlimited ?? null,
    callsIncluded: promo.callsIncluded ?? null,
    textsUnlimited: promo.textsUnlimited ?? null,
    textsIncluded: promo.textsIncluded ?? null,
    status: promo.status,
    sourceUrl: promo.sourceUrl ?? null,
    lastVerifiedAt: promo.lastVerifiedAt ?? null,
    sourceMetadata: (promo.sourceMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaPromoRepository implements PromoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureProvider(provider: ProviderSeed): Promise<void> {
    await upsertProvider(this.prisma, provider);
  }

  async countPublished(providerId: string, origin: PromoOrigin): Promise<number> {
    return this.prisma.promo.count({ where: { providerId, status: "ACTIVE", origin } });
  }

  async lastPublishedRunCount(providerId: string): Promise<number> {
    const run = await this.prisma.scrapeRun.findFirst({
      where: { providerId, status: "SUCCEEDED", published: true },
      orderBy: { startedAt: "desc" },
      select: { recordsAccepted: true },
    });
    return run?.recordsAccepted ?? 0;
  }

  async publishPromos(
    providerId: string,
    promos: PromoInput[],
    origin: PromoOrigin,
  ): Promise<PublishSummary> {
    keysOf(promos); // fail before opening a transaction
    return this.prisma.$transaction((tx) => replaceSet(tx, providerId, promos, origin), {
      timeout: 60_000,
    });
  }

  async publishMany(sets: PublishSet[]): Promise<Array<{ providerId: string } & PublishSummary>> {
    for (const set of sets) keysOf(set.promos); // fail before opening a transaction

    return this.prisma.$transaction(
      async (tx) => {
        const results: Array<{ providerId: string } & PublishSummary> = [];
        for (const set of sets) {
          await upsertProvider(tx, set.provider);
          const summary = await replaceSet(tx, set.provider.id, set.promos, set.origin);
          results.push({ providerId: set.provider.id, ...summary });
        }
        return results;
      },
      // A full sheet is a few hundred upserts; allow more than the 5 s default.
      { timeout: 60_000 },
    );
  }

  async publishRun(report: RunReport, promos: PromoInput[]): Promise<PublishSummary> {
    keysOf(promos); // fail before opening a transaction
    return this.prisma.$transaction(
      async (tx) => {
        const summary = await replaceSet(tx, report.providerId, promos, "COLLECTED");
        await createRun(tx, report);
        return summary;
      },
      { timeout: 60_000 },
    );
  }

  async recordRun(report: RunReport): Promise<void> {
    await createRun(this.prisma, report);
  }
}

function createRun(db: Tx | PrismaClient, report: RunReport) {
  // Diagnostics only: rejection reasons and overrides, never raw HTML or secrets.
  const rawPayload = {
    rejections: report.rejections,
    ...(report.override ? { override: report.override } : {}),
  };
  return db.scrapeRun.create({
    data: {
      providerId: report.providerId,
      status: report.status,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      recordsCollected: report.recordsCollected,
      recordsAccepted: report.recordsAccepted,
      recordsRejected: report.recordsRejected,
      published: report.published,
      errorDetail: report.errorDetail ?? null,
      rawPayload: rawPayload as Prisma.InputJsonValue,
    },
  });
}
