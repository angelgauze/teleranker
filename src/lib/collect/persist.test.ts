import { describe, expect, it } from "vitest";
import { MemoryPromoRepository } from "../db/memory-repository";
import type { PromoInput } from "../schema/promo";
import { createMemoryAlertSink } from "./alerts";
import { guardBaseline, persistRun, runProviderSafely } from "./persist";
import type { CollectProviderResult } from "./run";
import type { FetchPage, Logger, ProviderCollector } from "./types";

// Synthetic test record, not real provider data.
const promo: PromoInput = {
  providerId: "test",
  externalKey: "fixture-promo",
  name: "Fixture promo",
  priceCentavos: 5000,
  dataKind: "TOTAL",
  dataGb: 5,
  validityValue: 7,
  validityUnit: "DAY",
  compatibility: "UNKNOWN",
  status: "ACTIVE",
};

const provider = { id: "test", name: "Test provider", websiteUrl: "https://example.test" };
const silentLogger: Logger = { info() {}, warn() {}, error() {} };
const at = new Date("2026-11-20T00:00:00.000Z");

function resultOf(publish: boolean, promos: PromoInput[] = [promo]): CollectProviderResult {
  return {
    promos,
    decision: publish ? { publish: true } : { publish: false, reason: "no records were collected" },
    report: {
      providerId: "test",
      startedAt: at,
      completedAt: at,
      status: "SUCCEEDED",
      recordsCollected: promos.length,
      recordsAccepted: promos.length,
      recordsRejected: 0,
      published: publish,
      errorDetail: publish ? undefined : "no records were collected",
      rejections: [],
    },
  };
}

/** Shaped like the error Prisma throws when the server cannot be reached. */
function databaseUnreachable(): Error {
  return Object.assign(
    new Error("Invalid `prisma.promo.upsert()` invocation:\n\n  12 code excerpt\nCan't reach database server"),
    { name: "PrismaClientKnownRequestError", code: "P1001" },
  );
}

class FailingRepository extends MemoryPromoRepository {
  override async publishPromos(): Promise<never> {
    throw databaseUnreachable();
  }
}

describe("persistRun", () => {
  it("publishes a publishable run and records it", async () => {
    const repository = new MemoryPromoRepository();
    const alerts = createMemoryAlertSink();

    const report = await persistRun({
      repository,
      provider,
      result: resultOf(true),
      alerts,
      logger: silentLogger,
    });

    expect(report.published).toBe(true);
    expect(await repository.countPublished("test", "COLLECTED")).toBe(1);
    expect(repository.runs).toEqual([report]);
    expect(alerts.alerts).toHaveLength(0);
  });

  it("records a blocked run without publishing", async () => {
    const repository = new MemoryPromoRepository();
    await repository.publishPromos("test", [promo], "COLLECTED");

    const report = await persistRun({
      repository,
      provider,
      result: resultOf(false, []),
      alerts: createMemoryAlertSink(),
      logger: silentLogger,
    });

    expect(report.published).toBe(false);
    expect(await repository.countPublished("test", "COLLECTED")).toBe(1);
    expect(repository.runs).toHaveLength(1);
  });

  it("marks the run failed and alerts when the database write fails", async () => {
    const repository = new FailingRepository();
    const alerts = createMemoryAlertSink();

    const report = await persistRun({
      repository,
      provider,
      result: resultOf(true),
      alerts,
      logger: silentLogger,
      now: () => at,
    });

    expect(report.status).toBe("FAILED");
    expect(report.published).toBe(false);
    expect(report.errorDetail).toBe(
      "publish failed: database error: Database server could not be reached",
    );
    expect(repository.runs).toEqual([report]);
    expect(alerts.alerts).toEqual([
      expect.objectContaining({
        severity: "critical",
        providerId: "test",
        detail: "publish failed: database error: Database server could not be reached",
      }),
    ]);
  });
});

// Synthetic collector: returns one valid draft, no network.
const fixtureCollector: ProviderCollector = {
  providerId: "test",
  sourceUrls: ["https://example.test/promos"],
  async collect() {
    return {
      drafts: [
        {
          externalKey: "fixture-promo",
          name: "Fixture promo",
          priceCentavos: 5000,
          dataKind: "TOTAL",
          dataGb: 5,
          validityValue: 7,
          validityUnit: "DAY",
        },
      ],
      warnings: [],
    };
  },
};
const noFetch: FetchPage = async () => {
  throw new Error("no network in tests");
};

function providerFor(id: string) {
  return {
    id,
    name: id,
    websiteUrl: "https://example.test",
    collector: { ...fixtureCollector, providerId: id },
    sourceUrl: "https://example.test/promos",
  };
}

class DatabaseDownRepository extends MemoryPromoRepository {
  override async lastPublishedRunCount(): Promise<never> {
    throw databaseUnreachable();
  }
}

describe("runProviderSafely", () => {
  it("collects and publishes a provider", async () => {
    const repository = new MemoryPromoRepository();
    const { report } = await runProviderSafely({
      provider: providerFor("alpha"),
      repository,
      fetchPage: noFetch,
      alerts: createMemoryAlertSink(),
      logger: silentLogger,
    });
    expect(report.published).toBe(true);
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(1);
  });

  it("turns a database error into a failed run with an alert instead of throwing", async () => {
    const alerts = createMemoryAlertSink();
    const { report, reason } = await runProviderSafely({
      provider: providerFor("alpha"),
      repository: new DatabaseDownRepository(),
      fetchPage: noFetch,
      alerts,
      logger: silentLogger,
    });

    expect(report.status).toBe("FAILED");
    expect(report.published).toBe(false);
    expect(reason).toBe("database error: Database server could not be reached");
    expect(alerts.alerts).toEqual([
      expect.objectContaining({ severity: "critical", providerId: "alpha" }),
    ]);
  });

  it("lets the next provider run after one provider's database error", async () => {
    const healthy = new MemoryPromoRepository();
    const results = [];
    for (const [id, repository] of [
      ["alpha", new DatabaseDownRepository()],
      ["beta", healthy],
    ] as const) {
      results.push(
        await runProviderSafely({
          provider: providerFor(id),
          repository,
          fetchPage: noFetch,
          alerts: createMemoryAlertSink(),
          logger: silentLogger,
        }),
      );
    }

    expect(results.map((result) => result.report.status)).toEqual(["FAILED", "SUCCEEDED"]);
    expect(await healthy.countPublished("beta", "COLLECTED")).toBe(1);
  });
});

// Synthetic collector returning `count` valid drafts.
function collectorOf(id: string, count: number): ProviderCollector {
  return {
    providerId: id,
    sourceUrls: ["https://example.test/promos"],
    async collect() {
      return {
        drafts: Array.from({ length: count }, (_, index) => ({
          externalKey: `scraped-${index}`,
          name: `Scraped ${index}`,
          priceCentavos: 5000,
          dataKind: "TOTAL" as const,
          dataGb: 5,
          validityValue: 7,
          validityUnit: "DAY" as const,
        })),
        warnings: [],
      };
    },
  };
}

describe("drop guard against the last published run", () => {
  async function repositoryWithHistory() {
    const repository = new MemoryPromoRepository();
    // A good run published 7 promos earlier...
    await repository.recordRun({
      providerId: "alpha",
      startedAt: new Date("2026-11-13T00:00:00Z"),
      completedAt: new Date("2026-11-13T00:00:05Z"),
      status: "SUCCEEDED",
      recordsCollected: 7,
      recordsAccepted: 7,
      recordsRejected: 0,
      published: true,
      rejections: [],
    });
    // ...then a manual import replaced them with 36 promos.
    await repository.publishPromos(
      "alpha",
      Array.from({ length: 36 }, (_, index) => ({ ...promo, externalKey: `manual-${index}` })),
      "MANUAL",
    );
    return repository;
  }

  const run = (repository: MemoryPromoRepository, count: number) =>
    runProviderSafely({
      provider: { ...providerFor("alpha"), collector: collectorOf("alpha", count) },
      repository,
      fetchPage: noFetch,
      alerts: createMemoryAlertSink(),
      logger: silentLogger,
    });

  it("reads the accepted count of the latest successful published run", async () => {
    const repository = await repositoryWithHistory();
    expect(await repository.lastPublishedRunCount("alpha")).toBe(7);
    expect(await repository.lastPublishedRunCount("other")).toBe(0);
  });

  it("blocks a broken run after a manual import instead of replacing it", async () => {
    const repository = await repositoryWithHistory();
    const { report } = await run(repository, 1);

    expect(report.published).toBe(false);
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(36);
  });

  it("lets a recovered run supersede the larger manual set", async () => {
    const repository = await repositoryWithHistory();
    const { report } = await run(repository, 7);

    expect(report.published).toBe(true);
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(7);
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(0);
  });
});

describe("drop guard baseline without a published run", () => {
  async function manualOnly(count: number) {
    const repository = new MemoryPromoRepository();
    await repository.publishPromos(
      "alpha",
      Array.from({ length: count }, (_, index) => ({ ...promo, externalKey: `manual-${index}` })),
      "MANUAL",
    );
    return repository;
  }

  async function run(repository: MemoryPromoRepository, count: number, acceptSmallerSet = false) {
    const alerts = createMemoryAlertSink();
    const result = await runProviderSafely({
      provider: { ...providerFor("alpha"), collector: collectorOf("alpha", count) },
      repository,
      acceptSmallerSet,
      fetchPage: noFetch,
      alerts,
      logger: silentLogger,
    });
    return { ...result, alerts };
  }

  it("falls back to the hand-entered set when no run has published", async () => {
    expect(await guardBaseline(await manualOnly(36), "alpha")).toBe(36);
    expect(await guardBaseline(new MemoryPromoRepository(), "alpha")).toBe(0);
  });

  it("holds back a first run that would shrink a manual catalogue", async () => {
    const repository = await manualOnly(36);
    const { report, reason } = await run(repository, 3);

    expect(report.published).toBe(false);
    expect(reason).toMatch(/dropped to 8% of the published set \(3 of 36\)/);
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(36);
  });

  it("publishes a first run of similar size over the manual set", async () => {
    const repository = await manualOnly(36);
    const { report } = await run(repository, 20);

    expect(report.published).toBe(true);
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(20);
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(0);
  });

  it("publishes a smaller set when an administrator accepts it, and logs the override", async () => {
    const repository = await manualOnly(36);
    const { report, alerts } = await run(repository, 3, true);

    expect(report.published).toBe(true);
    expect(report.override).toMatch(/^accepted smaller set: record count dropped to 8%/);
    expect(repository.runs.at(-1)?.override).toBe(report.override);
    expect(alerts.alerts).toEqual([expect.objectContaining({ severity: "warning" })]);
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(3);
  });
});

describe("atomic publish and run log", () => {
  class RecordFailsOnceRepository extends MemoryPromoRepository {
    failures = 1;
    override async recordRun(report: Parameters<MemoryPromoRepository["recordRun"]>[0]) {
      if (this.failures-- > 0) throw databaseUnreachable();
      return super.recordRun(report);
    }
  }

  it("rolls the publish back when the run log cannot be written", async () => {
    const repository = new RecordFailsOnceRepository();
    await repository.publishPromos("test", [{ ...promo, externalKey: "old" }], "COLLECTED");
    const alerts = createMemoryAlertSink();

    const report = await persistRun({
      repository,
      provider,
      result: resultOf(true),
      alerts,
      logger: silentLogger,
    });

    // Neither the new set nor a "published" run was saved...
    expect(repository.get("test", "old")?.promo.status).toBe("ACTIVE");
    expect(repository.get("test", "fixture-promo")).toBeUndefined();
    // ...and the run is logged as failed, matching what is published.
    expect(report).toMatchObject({ status: "FAILED", published: false });
    expect(repository.runs).toEqual([report]);
    expect(alerts.alerts).toEqual([expect.objectContaining({ severity: "critical" })]);
  });

  it("labels errors that are not from the database as unexpected", async () => {
    class BuggyRepository extends MemoryPromoRepository {
      override async lastPublishedRunCount(): Promise<never> {
        throw new TypeError("cannot read properties of undefined");
      }
    }
    const { reason } = await runProviderSafely({
      provider: providerFor("alpha"),
      repository: new BuggyRepository(),
      fetchPage: noFetch,
      alerts: createMemoryAlertSink(),
      logger: silentLogger,
    });
    expect(reason).toBe("unexpected error: cannot read properties of undefined");
  });
});

describe("failed publish reporting", () => {
  class DatabaseGoneRepository extends MemoryPromoRepository {
    override async publishPromos(): Promise<never> {
      throw databaseUnreachable();
    }
    override async recordRun(): Promise<never> {
      throw databaseUnreachable();
    }
  }

  it("raises one alert and keeps the run's real counts when the run cannot be recorded", async () => {
    const alerts = createMemoryAlertSink();
    const { report } = await runProviderSafely({
      provider: { ...providerFor("alpha"), collector: collectorOf("alpha", 5) },
      repository: new DatabaseGoneRepository(),
      fetchPage: noFetch,
      alerts,
      logger: silentLogger,
    });

    expect(report).toMatchObject({
      status: "FAILED",
      published: false,
      recordsCollected: 5,
      recordsAccepted: 5,
      errorDetail: "publish failed: database error: Database server could not be reached",
    });
    expect(alerts.alerts).toEqual([
      expect.objectContaining({ title: "Publishing failed for alpha" }),
    ]);
  });

  it("only alerts and logs an override once the smaller set is published", async () => {
    class PublishFailsRepository extends MemoryPromoRepository {
      override async publishPromos(): Promise<never> {
        throw databaseUnreachable();
      }
    }
    const repository = new PublishFailsRepository();
    await MemoryPromoRepository.prototype.publishPromos.call(
      repository,
      "alpha",
      Array.from({ length: 36 }, (_, index) => ({ ...promo, externalKey: `manual-${index}` })),
      "MANUAL",
    );
    const alerts = createMemoryAlertSink();

    const { report } = await runProviderSafely({
      provider: { ...providerFor("alpha"), collector: collectorOf("alpha", 3) },
      repository,
      acceptSmallerSet: true,
      fetchPage: noFetch,
      alerts,
      logger: silentLogger,
    });

    expect(report.override).toBeUndefined();
    expect(report.errorDetail).toBe(
      "publish failed (the smaller-set override was not applied): database error: Database server could not be reached",
    );
    expect(repository.runs.at(-1)?.override).toBeUndefined();
    expect(alerts.alerts.map((alert) => alert.severity)).toEqual(["critical"]);
  });
});
