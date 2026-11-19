import { DITO_PROMO_URL, ditoCollector } from "./collectors/dito";
import { GLOBE_PROMO_URL, globeCollector } from "./collectors/globe";
import type { ProviderCollector } from "./types";

/**
 * Provider registry and the compliance record for each one.
 *
 * Every entry documents what was actually checked, when, and what was decided.
 * robots.txt is one input; it is not a substitute for reviewing provider terms
 * (AGENTS.md section 7). See docs/providers.md for the full notes.
 */

export type CollectionMode = "automated" | "manual-only";

export interface ProviderConfig {
  id: string;
  name: string;
  websiteUrl: string;
  collection: CollectionMode;
  sourceUrls: string[];
  collector?: ProviderCollector;
  compliance: {
    robotsReviewedAt: string;
    robotsNotes: string;
    /** Whether the provider's terms of use have been reviewed by a person. */
    termsReviewed: boolean;
    decision: string;
  };
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "globe",
    name: "Globe",
    websiteUrl: "https://www.globe.com.ph",
    collection: "automated",
    sourceUrls: [GLOBE_PROMO_URL],
    collector: globeCollector,
    compliance: {
      robotsReviewedAt: "2026-11-19",
      robotsNotes: "/prepaid/promos is not disallowed by robots.txt.",
      termsReviewed: false,
      decision:
        "Promo cards are server-rendered HTML and the path is permitted by robots.txt. Collection is rate-limited and identifies itself.",
    },
  },
  {
    id: "dito",
    name: "DITO",
    websiteUrl: "https://dito.ph",
    collection: "automated",
    sourceUrls: [DITO_PROMO_URL],
    collector: ditoCollector,
    compliance: {
      robotsReviewedAt: "2026-11-19",
      robotsNotes: "/prepaid is not disallowed by robots.txt.",
      termsReviewed: false,
      decision:
        "Promo cards are server-rendered HTML and the path is permitted by robots.txt. Collection is rate-limited and identifies itself.",
    },
  },
  {
    id: "smart",
    name: "Smart",
    websiteUrl: "https://smart.com.ph",
    collection: "manual-only",
    sourceUrls: [],
    compliance: {
      robotsReviewedAt: "2026-11-19",
      robotsNotes:
        "https://smart.com.ph/robots.txt redirects to a 404 page that returns HTML, so no rules could be read.",
      termsReviewed: false,
      decision:
        "Requests to promo pages answer with a JavaScript bot-protection challenge instead of content. Automated collection would mean bypassing an access control, which AGENTS.md section 7 forbids, so Smart promos must be entered by an administrator.",
    },
  },
];

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function getAutomatedProviders(): ProviderConfig[] {
  return PROVIDERS.filter((provider) => provider.collection === "automated" && provider.collector);
}
