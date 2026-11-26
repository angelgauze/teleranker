import type { Prisma } from "../../generated/prisma/client";
import { getPrismaClient } from "./client";
import { describeError } from "./errors";
import { effectiveStatus } from "../freshness";
import { computeValueMetrics, type ScoredPromo } from "../ranking/value";
import type { PromoInput, PromoOrigin } from "../schema/promo";
import { describeCollectionStatus, type CollectionStatus } from "../ui/collection-status";
import { hideDuplicates } from "./promo-duplicates";
import { buildPromoWhere, orderForListing, type PromoFilter } from "./promo-filter";

export type { PromoFilter } from "./promo-filter";

type PromoRow = Prisma.PromoGetPayload<{ include: { provider: true } }>;

/** Database problems get one short line; anything else keeps its stack. */
function logLoadError(what: string, error: unknown) {
  const described = describeError(error);
  if (described.isDatabase) console.error(`${what}: ${described.message}`);
  else console.error(what, error);
}

export interface PublishedPromo extends ScoredPromo {
  id: string;
  /** Collected by a run or entered manually from the sheet; both are listed. */
  origin: PromoOrigin;
  providerName: string;
  /** The provider's general promo page, for promos without their own link. */
  providerPromoPageUrl?: string;
}

export interface ListingResult {
  promos: PublishedPromo[];
  providers: Array<{ id: string; name: string }>;
  /** True when the database is not configured or unreachable. */
  databaseUnavailable: boolean;
}

/** `now` decides whether an active promo is shown as outdated (src/lib/freshness.ts). */
function toPromoInput(row: PromoRow, now: Date): PromoInput {
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
    noExpiry: row.noExpiry || undefined,
    compatibility: row.compatibility,
    callsUnlimited: row.callsUnlimited ?? undefined,
    callsIncluded: row.callsIncluded ?? undefined,
    textsUnlimited: row.textsUnlimited ?? undefined,
    textsIncluded: row.textsIncluded ?? undefined,
    status: effectiveStatus(row.status, row.lastVerifiedAt ?? undefined, now),
    sourceUrl: row.sourceUrl ?? undefined,
    lastVerifiedAt: row.lastVerifiedAt ?? undefined,
  };
}

function toPublished(row: PromoRow, now: Date): PublishedPromo {
  const promo = toPromoInput(row, now);
  return {
    id: row.id,
    origin: row.origin as PromoOrigin,
    providerName: row.provider.name,
    providerPromoPageUrl: row.provider.promoPageUrl ?? undefined,
    promo,
    metrics: computeValueMetrics(promo),
  };
}

export async function loadListing(filter: PromoFilter): Promise<ListingResult> {
  try {
    const prisma = getPrismaClient();
    const now = new Date();
    const [rows, providers] = await Promise.all([
      prisma.promo.findMany({
        where: buildPromoWhere(filter),
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
      promos: orderForListing(
        hideDuplicates(rows.map((row) => toPublished(row, now))),
        filter.sort,
      ),
      providers,
      databaseUnavailable: false,
    };
  } catch (error) {
    // Configuration problems are surfaced generically; details stay in logs.
    logLoadError("Failed to load promo listing", error);
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
    const now = new Date();
    const byId = new Map(rows.map((row) => [row.id, toPublished(row, now)]));
    return {
      promos: ids.map((id) => byId.get(id)).filter((promo): promo is PublishedPromo => Boolean(promo)),
      databaseUnavailable: false,
    };
  } catch (error) {
    logLoadError("Failed to load promos for comparison", error);
    return { promos: [], databaseUnavailable: true };
  }
}

export interface ProviderCollectionStatus {
  providerId: string;
  providerName: string;
  status: CollectionStatus;
}

/** Recent runs considered when describing a provider's collection status. */
const STATUS_RUN_WINDOW = 20;

/**
 * Public collection status for every active provider. Returns an empty list
 * instead of throwing, so a status problem never breaks the listing.
 */
export async function loadCollectionStatuses(): Promise<ProviderCollectionStatus[]> {
  try {
    const prisma = getPrismaClient();
    const [providers, listed] = await Promise.all([
      prisma.provider.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          scrapeRuns: {
            orderBy: { startedAt: "desc" },
            take: STATUS_RUN_WINDOW,
            select: { status: true, published: true, startedAt: true },
          },
        },
      }),
      prisma.promo.groupBy({
        by: ["providerId", "origin"],
        where: { status: { in: ["ACTIVE", "OUTDATED"] } },
        _count: { _all: true },
        _max: { lastVerifiedAt: true },
      }),
    ]);

    return providers.map((provider) => {
      const groups = listed.filter((group) => group.providerId === provider.id);
      const main = [...groups].sort((a, b) => b._count._all - a._count._all)[0];
      const manual = groups.find((group) => group.origin === "MANUAL");
      const bothSources = manual !== undefined && groups.some((group) => group.origin === "COLLECTED");
      const lastVerifiedAt = groups
        .map((group) => group._max.lastVerifiedAt)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        providerId: provider.id,
        providerName: provider.name,
        status: describeCollectionStatus({
          providerName: provider.name,
          runs: provider.scrapeRuns,
          origin: (main?.origin as PromoOrigin | undefined) ?? null,
          lastVerifiedAt,
          ...(bothSources ? { handEntered: { lastVerifiedAt: manual._max.lastVerifiedAt ?? undefined } } : {}),
        }),
      };
    });
  } catch (error) {
    logLoadError("Failed to load collection statuses", error);
    return [];
  }
}
