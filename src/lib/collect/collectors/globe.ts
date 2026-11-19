import * as cheerio from "cheerio";
import {
  collapseWhitespace,
  parseDataAllocation,
  parsePriceToCentavos,
  parseValidity,
  slugify,
  truncate,
} from "../normalize";
import type { CollectorResult, PromoDraft, ProviderCollector } from "../types";

/**
 * Globe prepaid promo collector.
 *
 * Source: https://www.globe.com.ph/prepaid/promos (server-rendered card list).
 * robots.txt reviewed 2026-11-19: the path is not disallowed. See
 * docs/providers.md for the compliance record.
 *
 * Card headline format: "20 GB Data | ₱99/7 Days" or "₱99/30 Days".
 * App-specific allocations are listed under the headline, so the `all-access`
 * figure is taken from the "N GB for All Sites" line, not from the total.
 */

export const GLOBE_PROMO_URL = "https://www.globe.com.ph/prepaid/promos";

const SKIP_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^globe\s+starlink\b/i,
    reason: "satellite-only promo, not comparable with mobile promos",
  },
];

const ALL_SITES_PATTERN = /^(\d+(?:\.\d+)?)\s*GB\s+for all sites\b/i;

export function parseGlobePromos(html: string): CollectorResult {
  const $ = cheerio.load(html);
  const drafts: PromoDraft[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  $(".section-b2c-promo__card-list").each((_index, element) => {
    const card = $(element);
    const name = collapseWhitespace(card.find(".card-title").first().text());
    if (!name) {
      warnings.push("Globe: skipped a card with no title");
      return;
    }

    const skip = SKIP_PATTERNS.find(({ pattern }) => pattern.test(name));
    if (skip) {
      warnings.push(`Globe: ${name} skipped - ${skip.reason}`);
      return;
    }

    const key = slugify(name);
    if (seen.has(key)) {
      warnings.push(`Globe: ${name} skipped - duplicate card`);
      return;
    }
    seen.add(key);

    const headline = collapseWhitespace(card.find("p.card-text").first().text());
    const inclusions = card
      .find(".card-text li")
      .toArray()
      .map((item) => collapseWhitespace($(item).text()))
      .filter(Boolean);

    const priceCentavos = parsePriceToCentavos(headline);
    const validity = parseValidity(headline);
    const data = parseDataAllocation(headline);

    if (priceCentavos === null || !validity || !data) {
      warnings.push(
        `Globe: ${name} skipped - could not read price, validity or data from "${headline}"`,
      );
      return;
    }

    const allSites = inclusions
      .map((line) => line.match(ALL_SITES_PATTERN))
      .find((match): match is RegExpMatchArray => match !== null);
    const allAccessGb = allSites ? Number(allSites[1]) : undefined;

    const notes = [...inclusions, "Register on GlobeOne"].join("; ");

    drafts.push({
      externalKey: key,
      name,
      priceCentavos,
      dataKind: data.kind,
      ...(data.kind === "TOTAL" ? { dataGb: data.gb } : {}),
      ...(allAccessGb !== undefined && data.kind === "TOTAL" ? { allAccessGb } : {}),
      dataNotes: truncate(notes, 500),
      validityValue: validity.value,
      validityUnit: validity.unit,
      textsUnlimited: /unli(mited)? texts?/i.test(notes) || undefined,
      // Compatibility is intentionally left unknown: the page mentions a 5G
      // bonus, but that does not prove the promo requires or supports 5G only.
    });
  });

  return { drafts, warnings };
}

export const globeCollector: ProviderCollector = {
  providerId: "globe",
  sourceUrls: [GLOBE_PROMO_URL],
  async collect({ fetchPage, logger }) {
    const page = await fetchPage(GLOBE_PROMO_URL);
    if (page.status !== 200) {
      throw new Error(`Globe promo page returned HTTP ${page.status}`);
    }

    logger.info("Globe: parsing promo page", { url: page.url, bytes: page.body.length });
    return parseGlobePromos(page.body);
  },
};
