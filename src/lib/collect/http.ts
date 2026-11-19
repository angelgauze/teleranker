import { EMPTY_ROBOTS, isPathAllowed, parseRobotsTxt, type RobotsRules } from "./robots";
import type { FetchPage } from "./types";

/**
 * Polite HTTP client for provider pages.
 *
 * - HTTPS only.
 * - robots.txt is fetched once per origin and enforced before every request.
 * - Requests to the same host are spaced out (`minIntervalMs`).
 * - Bounded size, timeout and limited retries.
 */

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

export class RobotsDisallowedError extends FetchError {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export interface PageFetcherOptions {
  userAgent: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  maxBytes?: number;
  retries?: number;
  enforceRobots?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function productToken(userAgent: string): string {
  return userAgent.split(/[/\s]/)[0].toLowerCase();
}

export function createPageFetcher(options: PageFetcherOptions): FetchPage {
  const {
    userAgent,
    timeoutMs = 15_000,
    minIntervalMs = 2_000,
    maxBytes = 2_000_000,
    retries = 1,
    enforceRobots = true,
  } = options;

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  const robotsByOrigin = new Map<string, RobotsRules>();
  const lastRequestAt = new Map<string, number>();

  async function loadRobots(origin: string): Promise<RobotsRules> {
    const cached = robotsByOrigin.get(origin);
    if (cached) return cached;

    const response = await fetchImpl(`${origin}/robots.txt`, {
      headers: { "user-agent": userAgent, accept: "text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    let rules: RobotsRules;
    if (response.status === 404 || response.status === 410) {
      // No robots.txt published: no crawl rules to enforce.
      rules = EMPTY_ROBOTS;
    } else if (!response.ok) {
      // Cannot verify permission - refuse to crawl rather than guess.
      throw new FetchError(`robots.txt returned HTTP ${response.status} for ${origin}`);
    } else {
      rules = parseRobotsTxt(await response.text(), productToken(userAgent));
    }

    robotsByOrigin.set(origin, rules);
    return rules;
  }

  async function waitForHost(host: string): Promise<void> {
    const wait = (lastRequestAt.get(host) ?? 0) + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt.set(host, now());
  }

  return async function fetchPage(target: string) {
    const url = new URL(target);
    if (url.protocol !== "https:") {
      throw new FetchError(`refusing non-HTTPS request: ${target}`);
    }

    if (enforceRobots) {
      const rules = await loadRobots(url.origin);
      if (!isPathAllowed(rules, url.pathname + url.search)) {
        throw new RobotsDisallowedError(target);
      }
    }

    await waitForHost(url.host);

    let attempt = 0;
    for (;;) {
      try {
        const response = await fetchImpl(target, {
          headers: {
            "user-agent": userAgent,
            accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.status >= 500 && attempt < retries) {
          attempt += 1;
          await sleep(1_000 * attempt);
          continue;
        }

        const body = await response.text();
        if (body.length > maxBytes) {
          throw new FetchError(`response from ${target} exceeds ${maxBytes} bytes`);
        }

        return { url: response.url || target, status: response.status, body };
      } catch (error) {
        if (attempt < retries && !(error instanceof FetchError)) {
          attempt += 1;
          await sleep(1_000 * attempt);
          continue;
        }

        if (error instanceof FetchError) throw error;
        throw new FetchError(
          `request to ${target} failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
  };
}
