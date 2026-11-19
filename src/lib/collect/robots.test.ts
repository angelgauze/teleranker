import { describe, expect, it } from "vitest";
import { EMPTY_ROBOTS, isPathAllowed, parseRobotsTxt } from "./robots";

// Trimmed from the live files on 2026-11-19.
const GLOBE_ROBOTS = `
User-agent: *
User-agent: GPTBot
User-agent: ClaudeBot

Disallow: /*?*f[*
Disallow: /content/
Disallow: /admin/
Disallow: /search/
`;

const DITO_ROBOTS = `
User-agent: *
Disallow: *?hsLang=en*
Disallow: /form/saf-main
Disallow: /_hcms/preview/
`;

describe("parseRobotsTxt", () => {
  it("collects rules from the wildcard group", () => {
    const rules = parseRobotsTxt(GLOBE_ROBOTS, "telerankerbot");
    expect(rules.disallow).toContain("/content/");
    expect(rules.disallow).toContain("/search/");
  });

  it("merges consecutive user-agent lines into one group", () => {
    const rules = parseRobotsTxt(GLOBE_ROBOTS, "claudebot");
    expect(rules.disallow).toContain("/content/");
  });

  it("returns no rules for an empty file", () => {
    expect(parseRobotsTxt("", "telerankerbot")).toEqual(EMPTY_ROBOTS);
  });
});

describe("isPathAllowed", () => {
  it("allows provider promo pages", () => {
    const globe = parseRobotsTxt(GLOBE_ROBOTS, "telerankerbot");
    const dito = parseRobotsTxt(DITO_ROBOTS, "telerankerbot");

    expect(isPathAllowed(globe, "/prepaid/promos")).toBe(true);
    expect(isPathAllowed(dito, "/prepaid")).toBe(true);
  });

  it("blocks disallowed prefixes and wildcard patterns", () => {
    const globe = parseRobotsTxt(GLOBE_ROBOTS, "telerankerbot");
    const dito = parseRobotsTxt(DITO_ROBOTS, "telerankerbot");

    expect(isPathAllowed(globe, "/content/private")).toBe(false);
    expect(isPathAllowed(globe, "/prepaid/promos?f[type]=data")).toBe(false);
    expect(isPathAllowed(dito, "/form/saf-main")).toBe(false);
    expect(isPathAllowed(dito, "/prepaid?hsLang=en")).toBe(false);
  });

  it("allows everything when no rules exist", () => {
    expect(isPathAllowed(EMPTY_ROBOTS, "/anything")).toBe(true);
  });
});
