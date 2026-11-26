import { describe, expect, it } from "vitest";
import { duplicateKey, fillCompatibilityFromSheet, hideDuplicates, isSamePromo, type ListedEntry } from "./promo-duplicates";

function entry(
  origin: ListedEntry["origin"],
  name: string,
  verified: string | undefined,
  extra: Partial<ListedEntry["promo"]> = {},
): ListedEntry & { id: string } {
  return {
    id: `${origin}:${name}:${verified}`,
    origin,
    promo: {
      providerId: "globe",
      name,
      priceCentavos: 10900,
      status: "ACTIVE",
      lastVerifiedAt: verified ? new Date(verified) : undefined,
      ...extra,
    },
  };
}

describe("duplicateKey", () => {
  it("ignores case, spaces and punctuation but not provider or price", () => {
    const a = entry("COLLECTED", "Go+109", "2026-11-26").promo;
    expect(duplicateKey(a)).toBe(duplicateKey(entry("MANUAL", "GO+ 109", "2026-11-17").promo));
    expect(duplicateKey(a)).not.toBe(duplicateKey({ ...a, priceCentavos: 11900 }));
    expect(duplicateKey(a)).not.toBe(duplicateKey({ ...a, providerId: "smart" }));
  });
});

describe("isSamePromo", () => {
  it("matches the scraped and manual copies of one promo, not different promos", () => {
    const a = entry("COLLECTED", "Go+109", "2026-11-26").promo;
    expect(isSamePromo(a, entry("MANUAL", "GO+ 109", "2026-11-17").promo)).toBe(true);
    expect(isSamePromo(a, { ...a, priceCentavos: 11900 })).toBe(false);
    expect(isSamePromo(a, { ...a, name: "Go+129" })).toBe(false);
  });
});

describe("hideDuplicates", () => {
  it("keeps promos that only one source lists", () => {
    const list = [
      entry("COLLECTED", "Go+109", "2026-11-26"),
      entry("MANUAL", "Go+149", "2026-11-17", { priceCentavos: 14900 }),
    ];
    expect(hideDuplicates(list)).toEqual(list);
  });

  it("shows the most recently checked copy of a promo both sources list", () => {
    const collected = entry("COLLECTED", "Go+109", "2026-11-26");
    const manual = entry("MANUAL", "GO+ 109", "2026-11-17");
    expect(hideDuplicates([manual, collected])).toEqual([collected]);

    const newerManual = entry("MANUAL", "GO+ 109", "2026-11-27");
    expect(hideDuplicates([collected, newerManual])).toEqual([newerManual]);
  });

  it("prefers the collected copy on the same date or when dates are unknown", () => {
    const collected = entry("COLLECTED", "Go+109", "2026-11-26");
    expect(hideDuplicates([entry("MANUAL", "Go+109", "2026-11-26"), collected])).toEqual([collected]);
    const undated = entry("COLLECTED", "Go+109", undefined);
    expect(hideDuplicates([entry("MANUAL", "Go+109", undefined), undated])).toEqual([undated]);
  });

  it("prefers a listed copy over one that is no longer offered", () => {
    const gone = entry("COLLECTED", "Go+109", "2026-11-26", { status: "UNAVAILABLE" });
    const manual = entry("MANUAL", "Go+109", "2026-11-17");
    expect(hideDuplicates([gone, manual])).toEqual([manual]);
  });

  it("never merges promos within one source", () => {
    const list = [entry("MANUAL", "Promo A", "2026-11-17"), entry("MANUAL", "Promo-A", "2026-11-18")];
    expect(hideDuplicates(list)).toEqual(list);
  });
});

describe("fillCompatibilityFromSheet", () => {
  const row = (
    origin: "COLLECTED" | "MANUAL",
    compatibility: "UNKNOWN" | "FOUR_G_AND_FIVE_G" | "FIVE_G",
    extra: Partial<ListedEntry["promo"]> = {},
  ) => ({
    origin,
    promo: {
      providerId: "globe",
      name: "Go+109",
      priceCentavos: 10900,
      status: "ACTIVE" as const,
      lastVerifiedAt: new Date("2026-11-26"),
      compatibility,
      ...extra,
    },
  });

  it("shows the sheet's checked value for an unverified scraped promo", () => {
    const scraped = row("COLLECTED", "UNKNOWN");
    const [filled] = fillCompatibilityFromSheet([scraped], [scraped, row("MANUAL", "FOUR_G_AND_FIVE_G", { name: "GO+ 109" })]);
    expect(filled.promo.compatibility).toBe("FOUR_G_AND_FIVE_G");
    expect(filled.compatibilityCheckedManually).toBe(true);
    expect(scraped.promo.compatibility).toBe("UNKNOWN"); // the input is not changed
  });

  it("keeps a new promo that is not in the sheet as Not verified", () => {
    const scraped = row("COLLECTED", "UNKNOWN", { name: "Go+999", priceCentavos: 99900 });
    const [kept] = fillCompatibilityFromSheet([scraped], [scraped, row("MANUAL", "FOUR_G_AND_FIVE_G")]);
    expect(kept.promo.compatibility).toBe("UNKNOWN");
    expect(kept.compatibilityCheckedManually).toBeUndefined();
  });

  it("never replaces a value the scraper read, and ignores unchecked or withdrawn sheet rows", () => {
    const read = row("COLLECTED", "FIVE_G");
    expect(fillCompatibilityFromSheet([read], [row("MANUAL", "FOUR_G_AND_FIVE_G")])[0].promo.compatibility).toBe("FIVE_G");
    const scraped = row("COLLECTED", "UNKNOWN");
    expect(fillCompatibilityFromSheet([scraped], [row("MANUAL", "UNKNOWN")])[0].promo.compatibility).toBe("UNKNOWN");
    expect(
      fillCompatibilityFromSheet([scraped], [row("MANUAL", "FOUR_G_AND_FIVE_G", { status: "UNAVAILABLE" })])[0].promo
        .compatibility,
    ).toBe("UNKNOWN");
  });
});
