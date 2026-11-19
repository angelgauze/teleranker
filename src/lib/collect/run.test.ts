import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "./registry";
import { ditoCollector } from "./collectors/dito";
import { collectProvider } from "./run";
import { createMemoryAlertSink } from "./alerts";
import type { FetchPage, Logger, ProviderCollector } from "./types";

const fixture = readFileSync(new URL("./collectors/fixtures/dito-prepaid.html", import.meta.url), "utf8");

const silentLogger: Logger = { info() {}, warn() {}, error() {} };

function pageOf(body: string, status = 200): FetchPage {
  return async (url) => ({ url, status, body });
}

const fixedNow = () => new Date("2026-11-19T00:00:00.000Z");

async function runWith(
  fetchPage: FetchPage,
  overrides: Partial<Parameters<typeof collectProvider>[0]> = {},
  collector: ProviderCollector = ditoCollector,
) {
  const alerts = createMemoryAlertSink();
  const result = await collectProvider({
    providerId: "dito",
    collector,
    fetchPage,
    logger: silentLogger,
    sourceUrl: "https://dito.ph/prepaid",
    previousPublishedCount: 0,
    now: fixedNow,
    alerts,
    ...overrides,
  });
  return { ...result, alerts };
}

describe("collectProvider", () => {
  it("collects, validates and marks a healthy run publishable", async () => {
    const { report, decision, promos, alerts } = await runWith(pageOf(fixture));

    expect(decision.publish).toBe(true);
    expect(report).toMatchObject({
      providerId: "dito",
      status: "SUCCEEDED",
      recordsCollected: 36,
      recordsAccepted: 36,
      recordsRejected: 0,
      published: true,
    });
    expect(promos.every((promo) => promo.status === "ACTIVE")).toBe(true);
    expect(promos.every((promo) => promo.lastVerifiedAt?.toISOString() === "2026-11-19T00:00:00.000Z")).toBe(true);
    expect(alerts.alerts).toHaveLength(0);
  });

  it("blocks an empty page and raises an alert", async () => {
    const { report, decision, alerts } = await runWith(pageOf("<html><body>no promos</body></html>"));

    expect(decision.publish).toBe(false);
    expect(decision.reason).toMatch(/no records/);
    expect(report.published).toBe(false);
    expect(alerts.alerts).toHaveLength(1);
    expect(alerts.alerts[0].severity).toBe("critical");
  });

  it("blocks a suspicious drop against the published set", async () => {
    const { decision, report, alerts } = await runWith(pageOf(fixture), {
      previousPublishedCount: 200,
    });

    expect(decision.publish).toBe(false);
    expect(decision.reason).toMatch(/dropped to 18%/);
    expect(report.errorDetail).toBe(decision.reason);
    expect(alerts.alerts).toHaveLength(1);
  });

  it("turns an HTTP error into a failed run without throwing", async () => {
    const { report, decision, promos, alerts } = await runWith(pageOf("forbidden", 403));

    expect(decision.publish).toBe(false);
    expect(report.status).toBe("FAILED");
    expect(report.errorDetail).toMatch(/HTTP 403/);
    expect(promos).toHaveLength(0);
    expect(alerts.alerts[0].severity).toBe("critical");
  });

  it("rejects records that fail schema validation", async () => {
    const brokenCollector: ProviderCollector = {
      providerId: "test",
      sourceUrls: ["https://example.invalid/promos"],
      async collect() {
        return {
          warnings: [],
          drafts: [
            {
              externalKey: "free-sample",
              name: "Free sample",
              priceCentavos: -1,
              dataKind: "TOTAL",
              dataGb: 5,
              validityValue: 7,
              validityUnit: "DAY",
            },
          ],
        };
      },
    };

    const { report, decision } = await runWith(pageOf("<html></html>"), {}, brokenCollector);

    expect(decision.publish).toBe(false);
    expect(report.recordsRejected).toBe(1);
    expect(report.rejections[0].reason).toMatch(/priceCentavos/);
  });

  it("deduplicates records that share a stable key", async () => {
    const duplicated: ProviderCollector = {
      providerId: "test",
      sourceUrls: ["https://example.invalid/promos"],
      async collect() {
        const draft = {
          externalKey: "same",
          name: "Same promo",
          priceCentavos: 10000,
          dataKind: "TOTAL" as const,
          dataGb: 5,
          validityValue: 7,
          validityUnit: "DAY" as const,
        };
        return { warnings: [], drafts: [draft, draft] };
      },
    };

    const { report, decision } = await runWith(pageOf("<html></html>"), {}, duplicated);
    expect(decision.publish).toBe(true);
    expect(report.recordsAccepted).toBe(1);
    expect(report.recordsRejected).toBe(1);
  });

  it("leaves the last-known-good data published when a later run is blocked", async () => {
    const { MemoryPromoRepository } = await import("../db/memory-repository");
    const repository = new MemoryPromoRepository();
    await repository.ensureProvider({
      id: "dito",
      name: "DITO",
      websiteUrl: "https://dito.ph",
    });

    const healthy = await runWith(pageOf(fixture));
    expect(healthy.decision.publish).toBe(true);
    await repository.publishPromos("dito", healthy.promos);
    expect(await repository.countPublished("dito")).toBe(36);

    const broken = await runWith(pageOf("<html><body>maintenance</body></html>"), {
      previousPublishedCount: await repository.countPublished("dito"),
    });

    expect(broken.decision.publish).toBe(false);
    if (broken.decision.publish) {
      await repository.publishPromos("dito", broken.promos);
    }
    expect(await repository.countPublished("dito")).toBe(36);
    expect(repository.runs).toHaveLength(0);
  });
});

describe("registry compliance records", () => {
  it("keeps Smart manual-only with a documented reason", async () => {
    const { PROVIDERS } = await import("./registry");
    const smart: ProviderConfig = PROVIDERS.find((provider) => provider.id === "smart")!;
    expect(smart.collection).toBe("manual-only");
    expect(smart.collector).toBeUndefined();
    expect(smart.compliance.decision).toMatch(/access control/);
  });

  it("only exposes collectors for automated providers", async () => {
    const { getAutomatedProviders } = await import("./registry");
    expect(getAutomatedProviders().map((provider) => provider.id).sort()).toEqual([
      "dito",
      "globe",
    ]);
  });
});
