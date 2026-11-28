import { describe, expect, it } from "vitest";
import { PROMO_ORIGINS, PROMO_STATUSES } from "../schema/promo";
import { COMPATIBILITY_NOTES, formatCalls, formatCallsTextsShort, formatChecked, formatDataAllocation, formatPerDay, formatStatus, sourceLinkFor, formatTexts, formatValidity, ORIGIN_LABELS, STATUS_LABELS } from "./format";

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

describe("formatCallsTextsShort", () => {
  it("joins both unlimited into one phrase", () => {
    expect(formatCallsTextsShort({ callsUnlimited: true, textsUnlimited: true })).toBe(
      "Unlimited calls and texts",
    );
  });

  it("keeps unknown, none, limited and counts distinct", () => {
    expect(formatCallsTextsShort({ textsUnlimited: true })).toBe("Calls unknown · Unlimited texts");
    expect(formatCallsTextsShort({ callsIncluded: 60, textsUnlimited: false })).toBe(
      "60 min calls · Limited texts",
    );
    expect(formatCallsTextsShort({ callsIncluded: 0, textsIncluded: 50 })).toBe("No calls · 50 texts");
    expect(formatCallsTextsShort({ callsUnlimited: false, textsIncluded: 0 })).toBe(
      "Limited calls · No texts",
    );
    expect(formatCallsTextsShort({})).toBe("Calls and texts unknown");
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

describe("formatChecked", () => {
  it("shows the verification date in Manila time", () => {
    expect(formatChecked(new Date("2026-11-18T16:30:00Z"))).toBe("Checked Nov 19, 2026");
  });

  it("says the check date is unknown instead of 'Checked Unknown'", () => {
    expect(formatChecked(undefined)).toBe("Check date unknown");
  });

  it("says how the promo was checked when the source is known", () => {
    const date = new Date("2026-11-25T16:30:00Z");
    expect(formatChecked(date, "COLLECTED")).toBe("Checked automatically Nov 26, 2026");
    expect(formatChecked(date, "MANUAL")).toBe("Checked manually Nov 26, 2026");
    expect(formatChecked(undefined, "MANUAL")).toBe("Checked manually, date unknown");
  });
});
