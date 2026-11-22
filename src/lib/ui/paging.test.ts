import { describe, expect, it } from "vitest";
import { PAGE_SIZE, parseShowCount, showMoreHref } from "./paging";

describe("parseShowCount", () => {
  it("shows one batch of 24 by default", () => {
    expect(PAGE_SIZE).toBe(24);
    expect(parseShowCount(undefined)).toBe(24);
  });

  it("accepts whole batches", () => {
    expect(parseShowCount("48")).toBe(48);
    expect(parseShowCount("240")).toBe(240);
  });

  it("rounds other numbers up to a whole batch", () => {
    expect(parseShowCount("30")).toBe(48);
    expect(parseShowCount("1")).toBe(24);
  });

  it("falls back to one batch for invalid values", () => {
    for (const raw of ["", "abc", "0", "-24", "2.5", "1e9", "48x"]) {
      expect(parseShowCount(raw)).toBe(24);
    }
  });

  it("caps very large requests", () => {
    expect(parseShowCount("100000")).toBe(2400);
  });
});

describe("showMoreHref", () => {
  it("keeps every filter and adds the next batch", () => {
    expect(showMoreHref({ provider: "dito", sort: "price", min: "", show: "24" }, 24)).toBe(
      "/?provider=dito&sort=price&show=48",
    );
  });

  it("works without any filters", () => {
    expect(showMoreHref({}, 24)).toBe("/?show=48");
  });

  it("uses the first value of a repeated parameter", () => {
    expect(showMoreHref({ provider: ["dito", "globe"] }, 48)).toBe("/?provider=dito&show=72");
  });
});
