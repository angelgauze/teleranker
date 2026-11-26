import { describe, expect, it } from "vitest";
import { describeCollectionStatus, type RunSummary } from "./collection-status";

const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, "0")}T02:00:00Z`);
const ok = (day: number): RunSummary => ({ status: "SUCCEEDED", published: true, startedAt: at(day) });
const failed = (day: number): RunSummary => ({ status: "FAILED", published: false, startedAt: at(day) });
const blocked = (day: number): RunSummary => ({ status: "SUCCEEDED", published: false, startedAt: at(day) });

describe("describeCollectionStatus", () => {
  it("reports a healthy automated provider", () => {
    const status = describeCollectionStatus({
      providerName: "DITO",
      runs: [ok(20), ok(13)],
      origin: "COLLECTED",
      lastVerifiedAt: at(20),
    });
    expect(status).toMatchObject({ tone: "ok", label: "Updated automatically" });
    expect(status.detail).toBe("Last checked Nov 20, 2026.");
  });

  it("reports paused updates since the first failure after the last completed run", () => {
    const status = describeCollectionStatus({
      providerName: "Globe",
      runs: [failed(27), failed(20), ok(13)],
      origin: "MANUAL",
      lastVerifiedAt: at(19),
    });
    expect(status.tone).toBe("paused");
    expect(status.detail).toBe(
      "Automatic checks have not completed since Nov 20, 2026. Showing details entered manually from Globe's promo page, last checked Nov 19, 2026.",
    );
  });

  it("does not count a held-back run as not completed", () => {
    const status = describeCollectionStatus({
      providerName: "DITO",
      runs: [failed(27), blocked(20), ok(13)],
      origin: "COLLECTED",
      lastVerifiedAt: at(13),
    });
    expect(status.label).toBe("Automatic updates paused");
    expect(status.detail).toMatch(/^Automatic checks have not completed since Nov 27, 2026\./);
  });

  it("handles a run that is still in progress", () => {
    const running: RunSummary = { status: "RUNNING", published: false, startedAt: at(27) };
    expect(
      describeCollectionStatus({ providerName: "DITO", runs: [running, ok(20)], origin: "COLLECTED" })
        .detail,
    ).toMatch(/since Nov 27, 2026/);
  });

  it("reports an update on hold when the latest check completed but was held back", () => {
    const status = describeCollectionStatus({
      providerName: "DITO",
      runs: [blocked(27), ok(20)],
      origin: "COLLECTED",
      lastVerifiedAt: at(20),
    });
    expect(status).toMatchObject({ tone: "paused", label: "Update on hold" });
    expect(status.detail).toBe(
      "The latest automatic check on Nov 27, 2026 found big changes, so they are waiting for review. Showing the details last verified Nov 20, 2026.",
    );
    expect(`${status.label} ${status.detail}`).not.toMatch(/cloudflare|challenge|bot|403|blocked/i);
  });

  it("reports paused updates when no run has ever succeeded", () => {
    const status = describeCollectionStatus({
      providerName: "Globe",
      runs: [failed(27), failed(20)],
      origin: null,
    });
    expect(status.detail).toBe(
      "Automatic checks have not completed since Nov 20, 2026. No verified details are available yet.",
    );
  });

  it("mentions hand-entered promos listed beside collected ones", () => {
    const healthy = describeCollectionStatus({
      providerName: "Globe",
      runs: [ok(26)],
      origin: "MANUAL",
      lastVerifiedAt: at(26),
      handEntered: { lastVerifiedAt: at(17) },
    });
    expect(healthy).toMatchObject({ tone: "ok", label: "Updated automatically" });
    expect(healthy.detail).toBe(
      "Last checked Nov 26, 2026. Promos the automatic check does not cover are entered manually from Globe's promo page, last checked Nov 17, 2026.",
    );

    const paused = describeCollectionStatus({
      providerName: "DITO",
      runs: [failed(25), ok(20)],
      origin: "MANUAL",
      lastVerifiedAt: at(26),
      handEntered: { lastVerifiedAt: at(26) },
    });
    expect(paused.detail).toBe(
      "Automatic checks have not completed since Nov 25, 2026. Showing the details last verified Nov 26, 2026. Promos the automatic check does not cover are entered manually from DITO's promo page, last checked Nov 26, 2026.",
    );
  });

  it("reports hand-entered providers", () => {
    const status = describeCollectionStatus({
      providerName: "Smart",
      runs: [],
      origin: "MANUAL",
      lastVerifiedAt: at(18),
    });
    expect(status).toMatchObject({ tone: "manual", label: "Entered manually" });
    expect(status.detail).toBe("From Smart's promo page, last checked Nov 18, 2026.");
  });

  it("reports providers with nothing published", () => {
    expect(
      describeCollectionStatus({ providerName: "GOMO", runs: [], origin: null }).tone,
    ).toBe("none");
  });

  it("never names technical blocking details", () => {
    const status = describeCollectionStatus({
      providerName: "Globe",
      runs: [failed(27)],
      origin: "MANUAL",
      lastVerifiedAt: at(19),
    });
    expect(`${status.label} ${status.detail}`).not.toMatch(/cloudflare|challenge|bot|403|blocked/i);
  });
});
