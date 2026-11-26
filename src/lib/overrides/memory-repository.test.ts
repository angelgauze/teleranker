import { describe, expect, it } from "vitest";
import { MemoryPromoRepository } from "../db/memory-repository";
import type { RunReport } from "../collect/types";
import type { PromoOverride } from "../schema/override";
import type { PromoInput } from "../schema/promo";

// Override storage in the in-memory repository, which mirrors the Prisma one
// (the PostgreSQL version is covered in prisma-repository.db.test.ts).
// Synthetic test records, not real provider data.

function promo(key: string, overrides: Partial<PromoInput> = {}): PromoInput {
  return {
    providerId: "test",
    externalKey: key,
    name: `Test ${key}`,
    priceCentavos: 5000,
    dataKind: "TOTAL",
    dataGb: 5,
    compatibility: "UNKNOWN",
    status: "ACTIVE",
    ...overrides,
  };
}

function override(key: string, compatibility: PromoOverride["compatibility"]): PromoOverride {
  return {
    providerId: "test",
    externalKey: key,
    compatibility,
    verifiedAt: new Date("2026-11-20T00:00:00+08:00"),
    sourceUrl: "https://example.test/promos",
  };
}

const run: RunReport = {
  providerId: "test",
  startedAt: new Date("2026-11-20T00:00:00Z"),
  completedAt: new Date("2026-11-20T00:00:00Z"),
  status: "SUCCEEDED",
  recordsCollected: 2,
  recordsAccepted: 2,
  recordsRejected: 0,
  published: true,
  rejections: [],
};

async function seeded() {
  const repository = new MemoryPromoRepository();
  await repository.publishRun(run, [promo("a"), promo("b", { compatibility: "FIVE_G" })]);
  return repository;
}

describe("MemoryPromoRepository overrides", () => {
  it("stores overrides and applies them to published collected promos", async () => {
    const repository = await seeded();
    const [summary] = await repository.replaceOverrides([
      { providerId: "test", overrides: [override("a", "FOUR_G_AND_FIVE_G"), override("gone", "FIVE_G")] },
    ]);

    expect(summary).toEqual({ providerId: "test", saved: 2, applied: 1, unmatched: ["gone"], restored: 0 });
    expect(repository.get("test", "a")?.promo.compatibility).toBe("FOUR_G_AND_FIVE_G");
    expect((await repository.listOverrides("test")).map((o) => o.externalKey)).toEqual(["a", "gone"]);
  });

  it("returns a promo to the collector's value when its override is removed", async () => {
    const repository = await seeded();
    await repository.replaceOverrides([
      { providerId: "test", overrides: [override("a", "FIVE_G"), override("b", "FOUR_G_AND_FIVE_G")] },
    ]);
    const [summary] = await repository.replaceOverrides([
      { providerId: "test", overrides: [override("a", "FIVE_G")] },
    ]);

    expect(summary.restored).toBe(1);
    expect(repository.get("test", "b")?.promo.compatibility).toBe("FIVE_G");
    expect(repository.get("test", "a")?.promo.compatibility).toBe("FIVE_G");
  });

  it("an empty set removes every override for the provider", async () => {
    const repository = await seeded();
    await repository.replaceOverrides([{ providerId: "test", overrides: [override("a", "FIVE_G")] }]);
    await repository.replaceOverrides([{ providerId: "test", overrides: [] }]);

    expect(await repository.listOverrides("test")).toEqual([]);
    expect(repository.get("test", "a")?.promo.compatibility).toBe("UNKNOWN");
  });

  it("does not touch hand-entered promos or other providers", async () => {
    const repository = await seeded();
    await repository.publishPromos("other", [promo("a", { providerId: "other" })], "MANUAL");
    const [summary] = await repository.replaceOverrides([
      { providerId: "other", overrides: [override("a", "FIVE_G")] },
    ]);

    expect(summary.applied).toBe(0);
    expect(summary.unmatched).toEqual(["a"]);
    expect(repository.get("other", "a")?.promo.compatibility).toBe("UNKNOWN");
    expect(repository.get("test", "a")?.promo.compatibility).toBe("UNKNOWN");
  });

  it("lists published collected promos as template candidates", async () => {
    const repository = await seeded();
    await repository.publishRun(run, [promo("a")]); // b is no longer offered
    const candidates = await repository.listOverrideCandidates("test");
    expect(candidates.map((candidate) => candidate.externalKey)).toEqual(["a"]);
  });

  it("remembers the collector's value from a later run", async () => {
    const repository = await seeded();
    await repository.replaceOverrides([{ providerId: "test", overrides: [override("a", "FIVE_G")] }]);
    // A later run where the collector now reports its own value for a.
    await repository.publishRun(
      run,
      [promo("a", { compatibility: "FIVE_G" }), promo("b")],
      new Map([["a", "FOUR_G_AND_FIVE_G"]]),
    );
    await repository.replaceOverrides([{ providerId: "test", overrides: [] }]);

    expect(repository.get("test", "a")?.promo.compatibility).toBe("FOUR_G_AND_FIVE_G");
  });
});
