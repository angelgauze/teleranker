import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../../generated/prisma/client";
import type { PromoInput } from "../schema/promo";
import { PrismaPromoRepository } from "./prisma-repository";
import { loadProviderOverview, loadProviderOverviews } from "./promos";
import { testDatabaseName } from "./test-database";

/**
 * Provider page loaders against a real PostgreSQL database (`pnpm test:db`).
 * Every test starts by deleting all promos and providers in the *_test
 * database. Records are synthetic test data, not real provider promos.
 */

const testUrl = process.env.TEST_DATABASE_URL;
const yesterday = () => new Date(Date.now() - 86_400_000);

function promo(providerId: string, key: string, overrides: Partial<PromoInput> = {}): PromoInput {
  return {
    providerId,
    externalKey: key,
    name: `Test promo ${key}`,
    priceCentavos: 5000,
    dataKind: "TOTAL",
    dataGb: 5,
    validityValue: 7,
    validityUnit: "DAY",
    compatibility: "UNKNOWN",
    status: "ACTIVE",
    lastVerifiedAt: yesterday(),
    ...overrides,
  };
}

describe.skipIf(!testUrl)("provider page loaders against PostgreSQL", () => {
  let prisma: PrismaClient;
  let repository: PrismaPromoRepository;

  beforeAll(() => {
    testDatabaseName(testUrl!, process.env.DATABASE_URL);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl! }) });
    repository = new PrismaPromoRepository(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await prisma.promo.deleteMany();
    await prisma.provider.deleteMany();
    for (const id of ["alpha", "beta", "gamma"]) {
      await repository.ensureProvider({
        id,
        name: id.toUpperCase(),
        websiteUrl: `https://${id}.example.test`,
        promoPageUrl: `https://${id}.example.test/promos`,
      });
    }
    await prisma.provider.update({ where: { id: "gamma" }, data: { isActive: false } });

    const run = {
      providerId: "alpha",
      startedAt: yesterday(),
      completedAt: yesterday(),
      status: "SUCCEEDED" as const,
      recordsCollected: 2,
      recordsAccepted: 2,
      recordsRejected: 0,
      published: true,
      rejections: [],
    };
    await repository.publishRun(run, [
      promo("alpha", "a", { priceCentavos: 1000, compatibility: "FIVE_G" }),
      promo("alpha", "b", { priceCentavos: 99900 }),
    ]);
    // b is no longer offered after this run.
    await repository.publishRun(run, [promo("alpha", "a", { priceCentavos: 1000, compatibility: "FIVE_G" })]);
    await repository.publishPromos(
      "beta",
      [promo("beta", "m", { priceCentavos: 29900, compatibility: "FOUR_G_AND_FIVE_G", lastVerifiedAt: undefined })],
      "MANUAL",
    );
  });

  it("summarises each active provider, alphabetically", async () => {
    const { providers, databaseUnavailable } = await loadProviderOverviews(prisma);

    expect(databaseUnavailable).toBe(false);
    expect(providers.map((provider) => provider.id)).toEqual(["alpha", "beta"]);

    const [alpha, beta] = providers;
    expect(alpha).toMatchObject({
      name: "ALPHA",
      websiteUrl: "https://alpha.example.test",
      promoPageUrl: "https://alpha.example.test/promos",
      status: { label: "Updated automatically" },
      summary: { current: 1, outdated: 0, minPriceCentavos: 1000, maxPriceCentavos: 1000 },
    });
    expect(alpha.summary.compatibility.FIVE_G).toBe(1);
    // No verification date: counted as outdated, like the listing.
    expect(beta).toMatchObject({
      status: { label: "Updated manually" },
      summary: { current: 1, outdated: 1, minPriceCentavos: 29900 },
    });
  });

  it("counts a promo in both sources once, with the sheet's 4G/5G when the scraper has none", async () => {
    const run = {
      providerId: "beta",
      startedAt: new Date(),
      completedAt: new Date(),
      status: "SUCCEEDED" as const,
      recordsCollected: 1,
      recordsAccepted: 1,
      recordsRejected: 0,
      published: true,
      rejections: [],
    };
    // The same promo (name and price) as beta's sheet row "m", scraped without 4G/5G.
    await repository.publishRun(run, [
      promo("beta", "scraped-m", { name: "Test promo m", priceCentavos: 29900, compatibility: "UNKNOWN" }),
    ]);
    const beta = (await loadProviderOverview("beta", prisma)).provider!;
    expect(beta.summary.current).toBe(1);
    expect(beta.summary.compatibility).toMatchObject({ FOUR_G_AND_FIVE_G: 1, UNKNOWN: 0 });
  });

  it("loads one provider, or null for an unknown or inactive one", async () => {
    expect((await loadProviderOverview("alpha", prisma)).provider?.summary.current).toBe(1);
    expect(await loadProviderOverview("gamma", prisma)).toEqual({ provider: null, databaseUnavailable: false });
    expect(await loadProviderOverview("nobody", prisma)).toEqual({ provider: null, databaseUnavailable: false });
  });

  it("reports the database as unavailable instead of throwing", async () => {
    const unreachable = new PrismaClient({
      adapter: new PrismaPg({ connectionString: "postgresql://nobody:nothing@127.0.0.1:1/missing_test" }),
    });
    try {
      expect(await loadProviderOverviews(unreachable)).toEqual({ providers: [], databaseUnavailable: true });
      expect(await loadProviderOverview("alpha", unreachable)).toEqual({ provider: null, databaseUnavailable: true });
    } finally {
      await unreachable.$disconnect();
    }
  });
});
