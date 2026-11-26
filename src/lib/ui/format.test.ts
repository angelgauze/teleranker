import { describe, expect, it } from "vitest";
import { PROMO_ORIGINS, PROMO_STATUSES } from "../schema/promo";
import { COMPATIBILITY_NOTES, formatCalls, formatDataAllocation, formatPerDay, formatStatus, sourceLinkFor, formatTexts, formatValidity, ORIGIN_LABELS, STATUS_LABELS } from "./format";

describe("formatStatus", () => {
  it("labels every status", () => {
    for (const status of PROMO_STATUSES) {
      expect(formatStatus(status)).toContain(STATUS_LABELS[status]);
    }
  });

  it("uses plain text labels, not color alone", () => {
    expect(formatStatus("ACTIVE")).toBe("Active");
    expect(formatStatus("OUTDATED")).toBe("Outdated");
    expect(formatStatus("UNAVAILABLE")).toBe("No longer offered");
  });
});

describe("formatValidity", () => {
  it("shows no expiry, a known period and unknown distinctly", () => {
    expect(formatValidity(undefined, undefined, true)).toBe("No expiry");
    expect(formatValidity(7, "DAY")).toBe("7 days");
    expect(formatValidity(1, "MONTH")).toBe("1 month");
    expect(formatValidity(undefined, undefined)).toBe("Unknown");
  });
});

describe("formatCalls and formatTexts", () => {
  it("keeps unlimited, none, a count, limited and unknown distinct", () => {
    expect(formatCalls({ callsUnlimited: true })).toBe("Unlimited");
    expect(formatCalls({ callsUnlimited: false, callsIncluded: 0 })).toBe("None");
    expect(formatCalls({ callsIncluded: 0 })).toBe("None");
    expect(formatCalls({ callsUnlimited: false, callsIncluded: 30 })).toBe("30 min");
    expect(formatCalls({ callsUnlimited: false })).toBe("Limited (minutes not stated)");
    expect(formatCalls({})).toBe("Unknown");

    expect(formatTexts({ textsUnlimited: true })).toBe("Unlimited");
    expect(formatTexts({ textsIncluded: 0 })).toBe("None");
    expect(formatTexts({ textsIncluded: 50 })).toBe("50 texts");
    expect(formatTexts({ textsUnlimited: false })).toBe("Limited (count not stated)");
    expect(formatTexts({})).toBe("Unknown");
  });
});

describe("formatDataAllocation", () => {
  it("labels unlimited, none and unknown instead of showing a number", () => {
    expect(formatDataAllocation("UNLIMITED", null)).toBe("Unlimited");
    expect(formatDataAllocation("NONE", null)).toBe("No data");
    expect(formatDataAllocation("UNKNOWN", null)).toBe("Unknown");
    expect(formatDataAllocation("TOTAL", 17)).toBe("17 GB");
    expect(formatDataAllocation("TOTAL", 1.5)).toBe("1.50 GB");
  });
});

describe("sourceLinkFor", () => {
  it("prefers the promo's own link", () => {
    expect(sourceLinkFor("https://example.test/p", "Alpha", "https://example.test/promos")).toEqual({
      href: "https://example.test/p",
      label: "Official source",
    });
  });

  it("falls back to the provider's promo page and says it is general", () => {
    expect(sourceLinkFor(undefined, "Alpha", "https://example.test/promos")).toEqual({
      href: "https://example.test/promos",
      label: "Alpha promo page",
      note: "General page; this promo has no page of its own",
    });
  });

  it("returns null when neither exists", () => {
    expect(sourceLinkFor(undefined, "Alpha", undefined)).toBeNull();
  });
});

describe("formatPerDay", () => {
  it("separates known, not applicable and unknown per-day figures", () => {
    expect(formatPerDay(1.4286, "gb")).toBe("1.43 GB/day");
    expect(formatPerDay(10, "php")).toBe("₱10.00/day");
    expect(formatPerDay(null, "gb", true)).toBe("Not applicable (no expiry)");
    expect(formatPerDay(null, "php")).toBe("Unknown");
  });
});

describe("COMPATIBILITY_NOTES", () => {
  it("explains that 5G-only promos need a 5G phone and 5G signal", () => {
    expect(COMPATIBILITY_NOTES.FIVE_G).toMatch(/5G phone and 5G signal/);
  });

  it("adds no note to promos that work on 4G or are not verified", () => {
    expect(COMPATIBILITY_NOTES.FOUR_G_AND_FIVE_G).toBeUndefined();
    expect(COMPATIBILITY_NOTES.FOUR_G).toBeUndefined();
    expect(COMPATIBILITY_NOTES.UNKNOWN).toBeUndefined();
  });
});

describe("ORIGIN_LABELS", () => {
  it("names how every origin was checked, in words", () => {
    for (const origin of PROMO_ORIGINS) expect(ORIGIN_LABELS[origin]).toMatch(/^Checked (automatically|manually)$/);
  });
});
