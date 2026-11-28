import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { summarizeProviderPromos, type ProviderSummary, type SummaryRow } from "../providers/summary";
import { getPrismaClient } from "./client";
import { describeError } from "./errors";
import { effectiveStatus } from "../freshness";
import { computeValueMetrics, type ScoredPromo } from "../ranking/value";
import type { PromoInput, PromoOrigin } from "../schema/promo";
import { describeCollectionStatus, type CollectionStatus } from "../ui/collection-status";
import { duplicateKey, fillCompatibilityFromSheet, hideDuplicates } from "./promo-duplicates";
import {
  buildPromoWhere,
  matchesCompatibility,
  matchesValidity,
  orderForListing,
  type PromoFilter,
} from "./promo-filter";

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
  /** The 4G/5G value came from the sheet because the scraped copy did not state it. */
  compatibilityCheckedManually?: true;
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

    // Hide duplicates, fill unverified 4G/5G from the sheet, then filter by 4G/5G and validity.
    const all = rows.map((row) => toPublished(row, now));
    const shown = fillCompatibilityFromSheet(hideDuplicates(all), all);
    return {
      promos: orderForListing(
        shown.filter(
          ({ promo }) =>
            matchesCompatibility(promo.compatibility, filter) && matchesValidity(promo, filter),
        ),
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
    // Sheet rows for the same promos, so an unverified scraped promo shows the
    // checked 4G/5G value here too (same rule as the listing).
    const keys = new Set(rows.map((row) => duplicateKey(toPublished(row, now).promo)));
    const sheetRows = rows.some((row) => row.origin === "COLLECTED" && row.compatibility === "UNKNOWN")
      ? await getPrismaClient().promo.findMany({
          where: {
            origin: "MANUAL",
            compatibility: { not: "UNKNOWN" },
            OR: rows.map((row) => ({ providerId: row.providerId, priceCentavos: row.priceCentavos })),
          },
          include: { provider: true },
        })
      : [];
    const sheet = sheetRows.map((row) => toPublished(row, now)).filter(({ promo }) => keys.has(duplicateKey(promo)));
    const filled = fillCompatibilityFromSheet(
      rows.map((row) => toPublished(row, now)),
      sheet,
    );
    const byId = new Map(filled.map((entry) => [entry.id, entry]));
    return {
      promos: ids.map((id) => byId.get(id)).filter((promo): promo is PublishedPromo => Boolean(promo)),
      databaseUnavailable: false,
    };
  } catch (error) {
    logLoadError("Failed to load promos for comparison", error);
    return { promos: [], databaseUnavailable: true };
  }
}

/** Recent runs considered when describing a provider's collection status. */
const STATUS_RUN_WINDOW = 20;

/** One provider as its provider page shows it. */
export interface ProviderOverview {
  id: string;
  name: string;
  websiteUrl?: string;
  promoPageUrl?: string;
  status: CollectionStatus;
  summary: ProviderSummary;
}

/** Every active provider, alphabetically. Never throws. */
export async function loadProviderOverviews(
  prisma?: PrismaClient,
): Promise<{ providers: ProviderOverview[]; databaseUnavailable: boolean }> {
  try {
    const providers = await readProviders(prisma ?? getPrismaClient());
    return { providers, databaseUnavailable: false };
  } catch (error) {
    logLoadError("Failed to load providers", error);
    return { providers: [], databaseUnavailable: true };
  }
}

/** One active provider, or null when the id is unknown or inactive. Never throws. */
export async function loadProviderOverview(
  id: string,
  prisma?: PrismaClient,
): Promise<{ provider: ProviderOverview | null; databaseUnavailable: boolean }> {
  try {
    const [provider] = await readProviders(prisma ?? getPrismaClient(), id);
    return { provider: provider ?? null, databaseUnavailable: false };
  } catch (error) {
    logLoadError("Failed to load provider", error);
    return { provider: null, databaseUnavailable: true };
  }
}

/**
 * Active providers (optionally one) with their public collection status and a
 * summary of their promos. Throws on database errors; the exported loaders
 * turn that into `databaseUnavailable`.
 */
async function readProviders(prisma: PrismaClient, id?: string): Promise<ProviderOverview[]> {
  const byProvider = id ? { providerId: id } : {};
  const [providers, listed, rows] = await Promise.all([
    prisma.provider.findMany({
      where: { isActive: true, ...(id ? { id } : {}) },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        promoPageUrl: true,
        scrapeRuns: {
          orderBy: { startedAt: "desc" },
          take: STATUS_RUN_WINDOW,
          select: { status: true, published: true, startedAt: true },
        },
      },
    }),
    prisma.promo.groupBy({
      by: ["providerId", "origin"],
      where: { ...byProvider, status: { in: ["ACTIVE", "OUTDATED"] } },
      _count: { _all: true },
      _max: { lastVerifiedAt: true },
    }),
    prisma.promo.findMany({
      where: { ...byProvider, status: { not: "UNAVAILABLE" } },
      select: {
        providerId: true,
        name: true,
        origin: true,
        status: true,
        priceCentavos: true,
        compatibility: true,
        lastVerifiedAt: true,
      },
    }),
  ]);

  const now = new Date();
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
      id: provider.id,
      name: provider.name,
      websiteUrl: provider.websiteUrl ?? undefined,
      promoPageUrl: provider.promoPageUrl ?? undefined,
      status: describeCollectionStatus({
        providerName: provider.name,
        runs: provider.scrapeRuns,
        origin: (main?.origin as PromoOrigin | undefined) ?? null,
        lastVerifiedAt,
        ...(bothSources ? { handEntered: { lastVerifiedAt: manual._max.lastVerifiedAt ?? undefined } } : {}),
      }),
      // Count each promo once when both sources list it, and use the sheet's
      // 4G/5G for unverified scraped promos, like the listing.
      summary: summarizeProviderPromos(
        summaryRows(rows.filter((row) => row.providerId === provider.id)),
        now,
      ),
    };
  });
}

/** Provider summary rows after hiding duplicates and filling 4G/5G from the sheet. */
function summaryRows(
  rows: Array<SummaryRow & { providerId: string; name: string; origin: string }>,
): SummaryRow[] {
  const entries = rows.map((row) => ({
    origin: row.origin as PromoOrigin,
    promo: {
      providerId: row.providerId,
      name: row.name,
      priceCentavos: row.priceCentavos,
      status: row.status,
      lastVerifiedAt: row.lastVerifiedAt ?? undefined,
      compatibility: row.compatibility,
    },
  }));
  return fillCompatibilityFromSheet(hideDuplicates(entries), entries).map(({ promo }) => ({
    status: promo.status,
    priceCentavos: promo.priceCentavos,
    compatibility: promo.compatibility,
    lastVerifiedAt: promo.lastVerifiedAt ?? null,
  }));
}
