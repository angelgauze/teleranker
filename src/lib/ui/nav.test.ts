import { describe, expect, it } from "vitest";
import { isCurrentPath, NAV_ITEMS } from "./nav";

describe("isCurrentPath", () => {
  it("matches the home page only on /", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/providers", "/")).toBe(false);
  });

  it("matches a section and the pages under it", () => {
    expect(isCurrentPath("/providers", "/providers")).toBe(true);
    expect(isCurrentPath("/providers/dito", "/providers")).toBe(true);
  });

  it("does not match other sections or lookalike paths", () => {
    expect(isCurrentPath("/compare", "/providers")).toBe(false);
    expect(isCurrentPath("/providersx", "/providers")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("lists Promos, Providers and Compare in order", () => {
    expect(NAV_ITEMS).toEqual([
      { href: "/", label: "Promos" },
      { href: "/providers", label: "Providers" },
      { href: "/compare", label: "Compare" },
    ]);
  });
});
