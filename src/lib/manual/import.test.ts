import { describe, expect, it } from "vitest";
import { evaluatePublish } from "../collect/publish";
import { MemoryPromoRepository } from "../db/memory-repository";
import type { ProviderSeed } from "../db/repository";
import type { PromoInput } from "../schema/promo";
import { REQUIRED_COLUMNS } from "./promo-sheet";
import { publishSheet, validateSheet, type ProviderPlan } from "./import";

// Synthetic providers and rows. Not real provider data.
const providers = new Map<string, ProviderSeed>([
  ["alpha", { id: "alpha", name: "Alpha", websiteUrl: "https://alpha.example.test" }],
  ["beta", { id: "beta", name: "Beta", websiteUrl: "https://beta.example.test" }],
]);

function row(promoId: string, brand: string, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    promo_id: promoId,
    brand_id: brand,
    promo_name: promoId.toUpperCase(),
    price_php: "50",
    open_gb: "5",
    app_gb: "0",
    is_unlimited_data: "no",
    validity_days: "3",
    is_no_expiry: "no",
    network_support: "4G",
    calls: "none",
    calls_minutes: "",
    texts: "none",
    source_url: "",
    source_type: "official_web",
    status: "active",
    last_verified_at: "2026-11-19",
    notes: "",
    ...overrides,
  };
  return REQUIRED_COLUMNS.map((column) => values[column]).join(",");
}

const csv = (...rows: string[]) => [REQUIRED_COLUMNS.join(","), ...rows].join("\n");

function plansOf(text: string): ProviderPlan[] {
  const result = validateSheet(text, providers);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.providers;
}

const collectedPromo = (key: string): PromoInput => ({
  providerId: "alpha",
  externalKey: key,
  name: key,
  priceCentavos: 5000,
  dataKind: "TOTAL",
  dataGb: 5,
  validityValue: 3,
  validityUnit: "DAY",
  compatibility: "UNKNOWN",
  status: "ACTIVE",
});

describe("validateSheet", () => {
  it("groups valid rows by provider", () => {
    const plans = plansOf(csv(row("a1", "alpha"), row("a2", "alpha"), row("b1", "beta")));
    expect(plans.map((plan) => [plan.providerId, plan.promos.length])).toEqual([
      ["alpha", 2],
      ["beta", 1],
    ]);
  });

  it("rejects the whole file when any row is invalid", () => {
    const result = validateSheet(
      csv(row("a1", "alpha"), row("a2", "alpha", { price_php: "free" })),
      providers,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rowErrors).toEqual([
        expect.objectContaining({ line: 3, promoId: "a2" }),
      ]);
    }
  });

  it("rejects unregistered providers and duplicate ids", () => {
    const result = validateSheet(
      csv(row("a1", "alpha"), row("a1", "alpha"), row("z1", "zeta")),
      providers,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const messages = result.rowErrors.flatMap((error) => error.errors).join("; ");
      expect(messages).toMatch(/duplicate promo_id \(first used on line 2\)/);
      expect(messages).toMatch(/"zeta" is not a registered provider/);
    }
  });

  it("rejects a file with missing columns or no rows", () => {
    const missing = validateSheet("promo_id,brand_id\nx,alpha", providers);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.fileErrors[0]).toMatch(/missing columns/);

    const empty = validateSheet(csv(), providers);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fileErrors[0]).toMatch(/no promo rows/);
  });
});

describe("publishSheet", () => {
  it("publishes each provider as a manual set", async () => {
    const repository = new MemoryPromoRepository();
    const outcomes = await publishSheet({
      plans: plansOf(csv(row("a1", "alpha"), row("b1", "beta"))),
      repository,
      knownProviders: providers,
    });

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["published", "published"]);
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(1);
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(0);
    expect(repository.providers.has("beta")).toBe(true);
  });

  it("marks promos missing from a newer sheet as no longer offered", async () => {
    const repository = new MemoryPromoRepository();
    await publishSheet({
      plans: plansOf(csv(row("a1", "alpha"), row("a2", "alpha"))),
      repository,
      knownProviders: providers,
    });
    const [outcome] = await publishSheet({
      plans: plansOf(csv(row("a1", "alpha"))),
      repository,
      knownProviders: providers,
    });
    expect(outcome).toMatchObject({ published: 1, markedUnavailable: 1 });
  });

  it("does not replace collector-published promos unless asked", async () => {
    const repository = new MemoryPromoRepository();
    await repository.publishPromos("alpha", [collectedPromo("scraped-1")], "COLLECTED");
    const plans = plansOf(csv(row("a1", "alpha")));

    const [skipped] = await publishSheet({ plans, repository, knownProviders: providers });
    expect(skipped.status).toBe("skipped");
    expect(await repository.countPublished("alpha", "COLLECTED")).toBe(1);

    const [replaced] = await publishSheet({
      plans,
      repository,
      knownProviders: providers,
      replaceCollected: true,
    });
    expect(replaced).toMatchObject({ status: "published", published: 1, markedUnavailable: 1 });
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(1);
  });

  it("lets a recovered collector run supersede a larger manual set", async () => {
    const repository = new MemoryPromoRepository();
    const manualRows = Array.from({ length: 10 }, (_, index) => row(`m${index}`, "alpha"));
    await publishSheet({ plans: plansOf(csv(...manualRows)), repository, knownProviders: providers });

    // The drop guard only compares with collector-published promos, so a
    // 3-promo run is not blocked by the 10-promo manual set.
    const previousCollected = await repository.countPublished("alpha", "COLLECTED");
    expect(
      evaluatePublish({ collected: 3, accepted: 3, rejected: 0, previousPublishedCount: previousCollected })
        .publish,
    ).toBe(true);

    const summary = await repository.publishPromos(
      "alpha",
      ["s1", "s2", "s3"].map(collectedPromo),
      "COLLECTED",
    );
    expect(summary).toEqual({ published: 3, markedUnavailable: 10 });
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(0);
  });

  it("keeps superseded and inactive promos with their status", async () => {
    const repository = new MemoryPromoRepository();
    await publishSheet({
      plans: plansOf(csv(row("a1", "alpha"), row("a2", "alpha"), row("a3", "alpha", { status: "outdated" }))),
      repository,
      knownProviders: providers,
    });

    // Only ACTIVE promos count, like the database.
    expect(await repository.countPublished("alpha", "MANUAL")).toBe(2);

    await publishSheet({ plans: plansOf(csv(row("a1", "alpha"))), repository, knownProviders: providers });
    expect(repository.get("alpha", "a2")?.promo.status).toBe("UNAVAILABLE");
    expect(repository.get("alpha", "a3")?.promo.status).toBe("OUTDATED");
    expect(repository.get("alpha", "a1")?.promo.status).toBe("ACTIVE");
  });
});

describe("publishSheet atomicity", () => {
  class FailsOnBeta extends MemoryPromoRepository {
    override async publishPromos(
      ...args: Parameters<MemoryPromoRepository["publishPromos"]>
    ): ReturnType<MemoryPromoRepository["publishPromos"]> {
      if (args[0] === "beta") throw new Error("connection lost");
      return super.publishPromos(...args);
    }
  }

  it("changes no provider when one provider's write fails", async () => {
    const repository = new FailsOnBeta();
    await repository.publishPromos("alpha", [collectedPromo("old")], "MANUAL");

    await expect(
      publishSheet({
        plans: plansOf(csv(row("a1", "alpha"), row("b1", "beta"))),
        repository,
        knownProviders: providers,
      }),
    ).rejects.toThrow("connection lost");

    // alpha was written before beta failed, and has been rolled back.
    expect(repository.get("alpha", "old")?.promo.status).toBe("ACTIVE");
    expect(repository.get("alpha", "a1")).toBeUndefined();
    expect(repository.providers.has("beta")).toBe(false);
  });

  it("returns outcomes in sheet order with skipped providers included", async () => {
    const repository = new MemoryPromoRepository();
    await repository.publishPromos("alpha", [collectedPromo("scraped-1")], "COLLECTED");

    const outcomes = await publishSheet({
      plans: plansOf(csv(row("a1", "alpha"), row("b1", "beta"))),
      repository,
      knownProviders: providers,
    });
    expect(outcomes.map((outcome) => [outcome.providerId, outcome.status])).toEqual([
      ["alpha", "skipped"],
      ["beta", "published"],
    ]);
  });
});
