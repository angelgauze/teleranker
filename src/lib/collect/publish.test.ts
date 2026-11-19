import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLISH_POLICY, evaluatePublish } from "./publish";

const baseline = { collected: 10, accepted: 10, rejected: 0, previousPublishedCount: 10 };

describe("evaluatePublish", () => {
  it("publishes a complete run", () => {
    expect(evaluatePublish(baseline)).toEqual({ publish: true });
  });

  it("publishes the first run for a provider", () => {
    expect(evaluatePublish({ ...baseline, previousPublishedCount: 0 })).toEqual({
      publish: true,
    });
  });

  it("blocks an empty run", () => {
    const decision = evaluatePublish({
      collected: 0,
      accepted: 0,
      rejected: 0,
      previousPublishedCount: 10,
    });
    expect(decision.publish).toBe(false);
    expect(decision.reason).toMatch(/no records/);
  });

  it("blocks a run where nothing passed validation", () => {
    const decision = evaluatePublish({
      collected: 10,
      accepted: 0,
      rejected: 10,
      previousPublishedCount: 10,
    });
    expect(decision.publish).toBe(false);
  });

  it("blocks a run with too many rejections", () => {
    const decision = evaluatePublish({
      ...baseline,
      accepted: 4,
      rejected: 6,
    });
    expect(decision.publish).toBe(false);
    expect(decision.reason).toMatch(/rejection rate/);
  });

  it("blocks a suspicious drop in record count", () => {
    const decision = evaluatePublish({
      collected: 4,
      accepted: 4,
      rejected: 0,
      previousPublishedCount: 10,
    });
    expect(decision.publish).toBe(false);
    expect(decision.reason).toMatch(/dropped to 40%/);
  });

  it("allows a small drop", () => {
    expect(
      evaluatePublish({
        collected: 9,
        accepted: 9,
        rejected: 0,
        previousPublishedCount: 10,
      }),
    ).toEqual({ publish: true });
  });

  it("allows a growth in record count", () => {
    expect(
      evaluatePublish({
        collected: 14,
        accepted: 14,
        rejected: 0,
        previousPublishedCount: 10,
      }),
    ).toEqual({ publish: true });
  });

  it("honours a custom policy", () => {
    const strict = { ...DEFAULT_PUBLISH_POLICY, minRetentionRatio: 0.9 };
    expect(
      evaluatePublish(
        { collected: 8, accepted: 8, rejected: 0, previousPublishedCount: 10 },
        strict,
      ).publish,
    ).toBe(false);
  });
});
