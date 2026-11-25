import { DITO_PROMO_URL, ditoCollector } from "./collectors/dito";
import { GLOBE_PROMO_URL, globeCollector } from "./collectors/globe";
import type { ProviderSeed } from "../db/repository";
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
  /** General public promo page, linked for promos without their own source link. */
  promoPageUrl: string;
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
    promoPageUrl: GLOBE_PROMO_URL,
    collection: "automated",
    sourceUrls: [GLOBE_PROMO_URL],
    collector: globeCollector,
    compliance: {
      robotsReviewedAt: "2026-11-19",
      robotsNotes:
        "/prepaid/promos was not disallowed by robots.txt on 2026-11-19. Since 2026-11-20 robots.txt answers HTTP 403 with a Cloudflare bot challenge, so runs fail safely and alert.",
      termsReviewed: false,
      decision:
        "Promo cards are server-rendered HTML and the path is permitted by robots.txt. Collection is rate-limited and identifies itself. Kept automated (team decision, 2026-11-20); while runs are blocked, a manual import (scripts/import-promos.ts) is the fallback, and the next successful run supersedes it.",
    },
  },
  {
    id: "dito",
    name: "DITO",
    websiteUrl: "https://dito.ph",
    promoPageUrl: DITO_PROMO_URL,
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
    promoPageUrl: "https://store.smart.com.ph/promos-and-add-ons/smart-prepaid/",
    collection: "manual-only",
    sourceUrls: [],
    compliance: {
      robotsReviewedAt: "2026-11-19",
      robotsNotes:
        "https://smart.com.ph/robots.txt redirects to a 404 page that returns HTML, so no rules could be read.",
      termsReviewed: false,
      decision:
        "Requests to promo pages answer with a JavaScript bot-protection challenge instead of content. Automated collection would mean bypassing an access control, which AGENTS.md section 7 forbids, so Smart promos must be entered by an administrator. The team also found (recorded 2026-11-20) that Smart's Terms of Use require users not to use any robot, spider, scraper or other automated means; formal terms sign-off is still pending.",
    },
  },
  {
    id: "tnt",
    name: "TNT",
    websiteUrl: "https://store.smart.com.ph/promos-and-add-ons/tnt/",
    promoPageUrl: "https://store.smart.com.ph/promos-and-add-ons/tnt/",
    collection: "manual-only",
    sourceUrls: [],
    compliance: {
      robotsReviewedAt: "2026-11-20",
      robotsNotes:
        "store.smart.com.ph/robots.txt does not disallow /promos-and-add-ons/, but the cards only appear through ad-tracking links.",
      termsReviewed: false,
      decision:
        "TNT is a Smart brand covered by Smart's Terms of Use, which require users not to use automated means. Treated as its own provider (team decision, 2026-11-20); promos are entered through the manual import.",
    },
  },
  {
    id: "gomo",
    name: "GOMO",
    websiteUrl: "https://www.gomo.ph",
    promoPageUrl: "https://www.gomo.ph/data-offers",
    collection: "manual-only",
    sourceUrls: [],
    compliance: {
      robotsReviewedAt: "2026-11-20",
      robotsNotes: "https://www.gomo.ph/robots.txt returns HTTP 404 (no rules).",
      termsReviewed: false,
      decision:
        "https://www.gomo.ph/data-offers server-renders only 8 featured offers; the full catalogue is only in the page's JavaScript state, which collectors may not execute. Automated collection would misrepresent the catalogue, so promos are entered through the manual import.",
    },
  },
];

/** The provider row written to the database by collection runs and imports. */
export function providerSeed(provider: ProviderConfig): ProviderSeed {
  return {
    id: provider.id,
    name: provider.name,
    websiteUrl: provider.websiteUrl,
    promoPageUrl: provider.promoPageUrl,
  };
}

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function getAutomatedProviders(): ProviderConfig[] {
  return PROVIDERS.filter((provider) => provider.collection === "automated" && provider.collector);
}
