import { describe, expect, it } from "vitest";
import { effectiveStatus, OUTDATED_AFTER_DAYS } from "./freshness";

const now = new Date("2026-12-04T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("effectiveStatus", () => {
  it("keeps a promo verified within 14 days active", () => {
    expect(OUTDATED_AFTER_DAYS).toBe(14);
    expect(effectiveStatus("ACTIVE", daysAgo(0), now)).toBe("ACTIVE");
    expect(effectiveStatus("ACTIVE", daysAgo(14), now)).toBe("ACTIVE");
  });

  it("marks a promo outdated once it is more than 14 days old", () => {
    expect(effectiveStatus("ACTIVE", daysAgo(14.01), now)).toBe("OUTDATED");
    expect(effectiveStatus("ACTIVE", daysAgo(30), now)).toBe("OUTDATED");
  });

  it("treats a promo with no verification date as outdated", () => {
    expect(effectiveStatus("ACTIVE", undefined, now)).toBe("OUTDATED");
  });

  it("never overrides a stored outdated or unavailable status", () => {
    expect(effectiveStatus("UNAVAILABLE", daysAgo(1), now)).toBe("UNAVAILABLE");
    expect(effectiveStatus("OUTDATED", daysAgo(1), now)).toBe("OUTDATED");
  });
});
