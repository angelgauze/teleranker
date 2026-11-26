import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../../generated/prisma/client";
import type { RunReport } from "../collect/types";
import type { PromoInput } from "../schema/promo";
import { PrismaPromoRepository } from "./prisma-repository";
import { testDatabaseName } from "./test-database";

/**
 * PrismaPromoRepository against a real PostgreSQL database.
 *
 * Run with `pnpm test:db` (not part of `pnpm test`). Needs TEST_DATABASE_URL
 * in .env pointing at a separate database whose name ends in "_test"; prepare
 * it once with `pnpm db:setup-test`. Every test starts by deleting all promos
 * and providers in that database. Skipped when TEST_DATABASE_URL is not set.
 *
 * Records are synthetic test data, not real provider promos.
 */

const testUrl = process.env.TEST_DATABASE_URL;

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 2));

function promo(key: string, overrides: Partial<PromoInput> = {}): PromoInput {
  return {
    providerId: "alpha",
    externalKey: key,
    name: `Test promo ${key}`,
    priceCentavos: 5000,
    dataKind: "TOTAL",
    dataGb: 5,
    validityValue: 7,
    validityUnit: "DAY",
    compatibility: "UNKNOWN",
    status: "ACTIVE",
    lastVerifiedAt: at(20),
    ...overrides,
  };
}

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    providerId: "alpha",
    startedAt: at(20),
    completedAt: at(20),
    status: "SUCCEEDED",
    recordsCollected: 2,
    recordsAccepted: 2,
    recordsRejected: 0,
    published: true,
    rejections: [],
    ...overrides,
  };
}

describe.skipIf(!testUrl)("PrismaPromoRepository against PostgreSQL", () => {
  let prisma: PrismaClient;
  let repository: PrismaPromoRepository;

  beforeAll(() => {
    testDatabaseName(testUrl!, process.env.DATABASE_URL); // throws unless a separate *_test database
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl! }) });
    repository = new PrismaPromoRepository(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await prisma.promo.deleteMany();
    await prisma.provider.deleteMany(); // cascades to runs and reviews
    for (const id of ["alpha", "beta"]) {
      await repository.ensureProvider({ id, name: id, websiteUrl: "https://example.test" });
    }
  });

  const statusOf = async (externalKey: string) =>
    (await prisma.promo.findFirst({ where: { providerId: "alpha", externalKey } }))?.status;

  it("publishes a run's promos and its run log together", async () => {
    const summary = await repository.publishRun(report(), [promo("a"), promo("b")]);

    expect(summary).toEqual({ published: 2, markedUnavailable: 0 });
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(2);
    expect(await prisma.scrapeRun.count({ where: { providerId: "alpha", published: true } })).toBe(1);
    expect(await repository.lastPublishedRunCount("alpha")).toBe(2);
  });

  it("replaces the active set and marks missing promos as no longer offered", async () => {
    await repository.publishPromos("alpha", [promo("a"), promo("b")], "MANUAL");
    const summary = await repository.publishRun(report(), [promo("b"), promo("c")]);

    expect(summary).toEqual({ published: 2, markedUnavailable: 1 });
    expect(await statusOf("a")).toBe("UNAVAILABLE");
    expect(await statusOf("c")).toBe("ACTIVE");
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(0);
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(2);
  });

  it("rolls the promos back when the run log cannot be written", async () => {
    await repository.publishPromos("alpha", [promo("old")], "COLLECTED");

    // An invalid date makes the run-log insert fail after the promos were written.
    await expect(
      repository.publishRun(report({ startedAt: new Date(Number.NaN) }), [promo("new")]),
    ).rejects.toThrow();

    expect(await statusOf("old")).toBe("ACTIVE");
    expect(await statusOf("new")).toBeUndefined();
    expect(await prisma.scrapeRun.count()).toBe(0);
  });

  it("publishes several providers all or nothing", async () => {
    await expect(
      repository.publishMany([
        { provider: { id: "alpha", name: "alpha", websiteUrl: "https://example.test" }, promos: [promo("a")], origin: "MANUAL" },
        {
          provider: { id: "beta", name: "beta", websiteUrl: "https://example.test" },
          // Beyond PostgreSQL's integer range: the second provider fails.
          promos: [promo("x", { providerId: "beta", priceCentavos: 3_000_000_000 })],
          origin: "MANUAL",
        },
      ]),
    ).rejects.toThrow();

    expect(await prisma.promo.count()).toBe(0);
  });

  it("reads the latest successful published run for the drop guard", async () => {
    await repository.recordRun(report({ startedAt: at(1), recordsAccepted: 7 }));
    await repository.recordRun(report({ startedAt: at(3), recordsAccepted: 2, published: false }));
    await repository.recordRun(report({ startedAt: at(4), status: "FAILED", published: false }));
    expect(await repository.lastPublishedRunCount("alpha")).toBe(7);
    expect(await repository.lastPublishedRunCount("beta")).toBe(0);

    await repository.recordRun(report({ startedAt: at(5), recordsAccepted: 5 }));
    expect(await repository.lastPublishedRunCount("alpha")).toBe(5);
  });

  it("keeps an administrator override in the run log", async () => {
    await repository.publishRun(report({ override: "accepted smaller set: test" }), [promo("a")]);
    const run = await prisma.scrapeRun.findFirstOrThrow({ where: { providerId: "alpha" } });
    expect(run.rawPayload).toMatchObject({ override: "accepted smaller set: test" });
  });
});
