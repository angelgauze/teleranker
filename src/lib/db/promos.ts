import type { Prisma } from "../../generated/prisma/client";
import { getPrismaClient } from "./client";
import { computeValueMetrics, sortScored, type ScoredPromo, type SortKey } from "../ranking/value";
import type { PromoCompatibility, PromoInput } from "../schema/promo";

type PromoRow = Prisma.PromoGetPayload<{ include: { provider: true } }>;

export interface PublishedPromo extends ScoredPromo {
  id: string;
  providerName: string;
}

export interface PromoFilter {
  providerId?: string;
  minPriceCentavos?: number;
  maxPriceCentavos?: number;
  /** Matches promos that work on that network generation. */
  compatibility?: PromoCompatibility;
  sort: SortKey;
}

export interface ListingResult {
  promos: PublishedPromo[];
  providers: Array<{ id: string; name: string }>;
  /** True when the database is not configured or unreachable. */
  databaseUnavailable: boolean;
}

function toPromoInput(row: PromoRow): PromoInput {
  return {
    providerId: row.providerId,
    externalKey: row.externalKey ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    priceCentavos: row.priceCentavos,
    dataKind: row.dataKind,
    dataGb: row.dataGb === null ? undefined : Number(row.dataGb),
    allAccessGb: row.allAccessGb === null ? undefined : Number(row.allAccessGb),
    dataNotes: row.dataNotes ?? undefined,
    validityValue: row.validityValue ?? undefined,
    validityUnit: row.validityUnit ?? undefined,
    compatibility: row.compatibility,
    callsUnlimited: row.callsUnlimited ?? undefined,
    callsIncluded: row.callsIncluded ?? undefined,
    textsUnlimited: row.textsUnlimited ?? undefined,
    textsIncluded: row.textsIncluded ?? undefined,
    status: row.status,
    sourceUrl: row.sourceUrl ?? undefined,
    lastVerifiedAt: row.lastVerifiedAt ?? undefined,
  };
}

function toPublished(row: PromoRow): PublishedPromo {
  const promo = toPromoInput(row);
  return {
    id: row.id,
    providerName: row.provider.name,
    promo,
    metrics: computeValueMetrics(promo),
  };
}

/** A 4G filter also matches dual-network promos, and vice versa. */
function compatibilityWhere(compatibility: PromoCompatibility) {
  const values: PromoCompatibility[] =
    compatibility === "FOUR_G"
      ? ["FOUR_G", "FOUR_G_AND_FIVE_G"]
      : compatibility === "FIVE_G"
        ? ["FIVE_G", "FOUR_G_AND_FIVE_G"]
        : [compatibility];

  return { compatibility: { in: values } };
}

export async function loadListing(filter: PromoFilter): Promise<ListingResult> {
  try {
    const prisma = getPrismaClient();
    const [rows, providers] = await Promise.all([
      prisma.promo.findMany({
        where: {
          status: "ACTIVE",
          ...(filter.providerId ? { providerId: filter.providerId } : {}),
          ...(filter.minPriceCentavos !== undefined || filter.maxPriceCentavos !== undefined
            ? {
                priceCentavos: {
                  ...(filter.minPriceCentavos !== undefined
                    ? { gte: filter.minPriceCentavos }
                    : {}),
                  ...(filter.maxPriceCentavos !== undefined
                    ? { lte: filter.maxPriceCentavos }
                    : {}),
                },
              }
            : {}),
          ...(filter.compatibility ? compatibilityWhere(filter.compatibility) : {}),
        },
        include: { provider: true },
        orderBy: { priceCentavos: "asc" },
      }),
      prisma.provider.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      promos: sortScored(rows.map(toPublished), filter.sort),
      providers,
      databaseUnavailable: false,
    };
  } catch (error) {
    // Configuration problems are surfaced generically; details stay in logs.
    console.error("Failed to load promo listing", error);
    return { promos: [], providers: [], databaseUnavailable: true };
  }
}

export async function loadPromosByIds(ids: string[]): Promise<{
  promos: PublishedPromo[];
  databaseUnavailable: boolean;
}> {
  if (ids.length === 0) return { promos: [], databaseUnavailable: false };

  try {
    const rows = await getPrismaClient().promo.findMany({
      where: { id: { in: ids } },
      include: { provider: true },
    });
    // Preserve the order of the requested ids.
    const byId = new Map(rows.map((row) => [row.id, toPublished(row)]));
    return {
      promos: ids.map((id) => byId.get(id)).filter((promo): promo is PublishedPromo => Boolean(promo)),
      databaseUnavailable: false,
    };
  } catch (error) {
    console.error("Failed to load promos for comparison", error);
    return { promos: [], databaseUnavailable: true };
  }
}
