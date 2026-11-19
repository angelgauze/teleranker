/**
 * Minimal robots.txt handling.
 *
 * Robots rules are one input to the compliance decision (AGENTS.md section 7),
 * not a substitute for reviewing a provider's terms. The scraper enforces them
 * at request time: a disallowed path is never fetched.
 */

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

interface RobotsGroup {
  agents: string[];
  rules: Array<{ type: "allow" | "disallow"; path: string }>;
}

export const EMPTY_ROBOTS: RobotsRules = { allow: [], disallow: [] };

export function parseRobotsTxt(text: string, userAgentToken: string): RobotsRules {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one group; a group with rules ends
      // the previous one.
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((field === "allow" || field === "disallow") && current && value) {
      current.rules.push({ type: field, path: value });
    }
  }

  const token = userAgentToken.toLowerCase();
  const matching = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || token.includes(agent)),
  );

  const rules: RobotsRules = { allow: [], disallow: [] };
  for (const group of matching) {
    for (const rule of group.rules) {
      (rule.type === "allow" ? rules.allow : rules.disallow).push(rule.path);
    }
  }

  return rules;
}

function patternToRegExp(pattern: string): RegExp {
  let body = pattern;
  let anchored = false;

  if (body.endsWith("$")) {
    anchored = true;
    body = body.slice(0, -1);
  }

  const escaped = body
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; ties favour Allow, as in the Robots spec. */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const matches: Array<{ length: number; allowed: boolean }> = [];

  const consider = (patterns: string[], allowed: boolean) => {
    for (const pattern of patterns) {
      if (patternToRegExp(pattern).test(path)) {
        matches.push({ length: pattern.length, allowed });
      }
    }
  };

  consider(rules.allow, true);
  consider(rules.disallow, false);

  if (matches.length === 0) return true;

  matches.sort((a, b) => b.length - a.length || Number(b.allowed) - Number(a.allowed));
  return matches[0].allowed;
}
