import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { PromoInput } from "../schema/promo";
import type { RunReport } from "../collect/types";
import type {
  PromoRepository,
  ProviderSeed,
  PublishSummary,
} from "./repository";

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
    await this.prisma.provider.upsert({
      where: { id: provider.id },
      create: { id: provider.id, name: provider.name, websiteUrl: provider.websiteUrl },
      update: { name: provider.name, websiteUrl: provider.websiteUrl },
    });
  }

  async countPublished(providerId: string): Promise<number> {
    return this.prisma.promo.count({ where: { providerId, status: "ACTIVE" } });
  }

  async publishPromos(providerId: string, promos: PromoInput[]): Promise<PublishSummary> {
    const keys = promos.map((promo) => promo.externalKey).filter((key): key is string => Boolean(key));
    if (keys.length !== promos.length) {
      throw new Error("every published promo needs a stable externalKey");
    }

    return this.prisma.$transaction(async (tx) => {
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
        const data = toWriteData(promo);
        await tx.promo.upsert({
          where: { providerId_externalKey: { providerId, externalKey } },
          create: { providerId, externalKey, ...data },
          update: data,
        });
      }

      return { published: promos.length, markedUnavailable: markedUnavailable.count };
    });
  }

  async recordRun(report: RunReport): Promise<void> {
    await this.prisma.scrapeRun.create({
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
        // Diagnostics only: rejection reasons, never raw HTML or secrets.
        rawPayload: { rejections: report.rejections } as Prisma.InputJsonValue,
      },
    });
  }
}
