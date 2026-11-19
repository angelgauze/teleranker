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
 * DITO prepaid promo collector.
 *
 * Source: https://dito.ph/prepaid (server-rendered card list).
 * robots.txt reviewed 2026-11-19: /prepaid is not disallowed. See
 * docs/providers.md for the compliance record.
 *
 * Card layout:
 *   header  -> promo name ("DATA MAXX 70", "UNLI5G MAXX 99")
 *   body    -> "DATA ALLOCATION" label, then the allowance, then inclusions
 *   footer  -> price ("₱70", sometimes "P70") and "Valid for 7 days"
 *
 * Some cards have no price (e.g. "PLAY IT"), and some sell "Unlimited 5G" plus
 * a separate 4G allowance. Those cannot be reduced to a single GB figure, so
 * they are stored as UNLIMITED with the full details in `dataNotes`.
 */

export const DITO_PROMO_URL = "https://dito.ph/prepaid";

const UNLIMITED_HEAD = /^(unli(mited)?|unli\s*5g)\b/i;
const ALL_ACCESS_PATTERN = /(\d+(?:\.\d+)?)\s*GB\s+all[- ]access\b/i;

export function parseDitoPromos(html: string): CollectorResult {
  const $ = cheerio.load(html);
  const drafts: PromoDraft[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  $(".card-universal-layout").each((_index, element) => {
    const card = $(element);
    const name = collapseWhitespace(card.find("h3").first().text());
    if (!name) {
      warnings.push("DITO: skipped a card with no title");
      return;
    }

    const key = slugify(name);
    if (seen.has(key)) {
      warnings.push(`DITO: ${name} skipped - duplicate card`);
      return;
    }
    seen.add(key);

    const body = collapseWhitespace(card.find(".card-body").text()).replace(
      /^data allocation\s*/i,
      "",
    );
    const footer = collapseWhitespace(card.find(".card-footer .footer-text").text());

    const priceCentavos = parsePriceToCentavos(footer);
    const validity = parseValidity(footer);

    if (priceCentavos === null) {
      warnings.push(`DITO: ${name} skipped - no price published on the card`);
      return;
    }
    if (!validity) {
      warnings.push(`DITO: ${name} skipped - no validity period published on the card`);
      return;
    }

    const unlimited = UNLIMITED_HEAD.test(body);
    const data = unlimited ? null : parseDataAllocation(body);
    if (!unlimited && !data) {
      warnings.push(`DITO: ${name} skipped - could not read a data allowance`);
      return;
    }

    const explicitAllAccess = body.match(ALL_ACCESS_PATTERN);
    let allAccessGb: number | undefined;
    if (unlimited) {
      // The allowance is not a single comparable GB figure; it stays in notes.
      allAccessGb = undefined;
    } else if (explicitAllAccess) {
      allAccessGb = Number(explicitAllAccess[1]);
    } else if (
      data?.kind === "TOTAL" &&
      /all[- ]access/i.test(body) &&
      !/app data|for apps|apps?\b/i.test(body)
    ) {
      allAccessGb = data.gb;
    }

    const allNet = /all[- ]?net|all mobile networks/i.test(body);
    // Only an allowance stated directly after "unlimited"/"unli" counts as
    // unlimited; "300 mins calls" and "Unli DITO to DITO calls" must not.
    const unlimitedCalls =
      /(unlimited|unli)\s+calls?/i.test(body) ||
      /(unlimited|unli)\s+calls?\s*(&|and)\s*(texts?|sms)/i.test(body);
    const unlimitedTexts =
      /(unlimited|unli)\s+(texts?|sms)/i.test(body) ||
      /(unlimited|unli)\s+calls?\s*(&|and)\s*(texts?|sms)/i.test(body);

    drafts.push({
      externalKey: key,
      name,
      priceCentavos,
      dataKind: unlimited ? "UNLIMITED" : (data?.kind ?? "UNKNOWN"),
      ...(data?.kind === "TOTAL" && !unlimited ? { dataGb: data.gb } : {}),
      ...(allAccessGb !== undefined ? { allAccessGb } : {}),
      dataNotes: truncate(body, 500),
      validityValue: validity.value,
      validityUnit: validity.unit,
      callsUnlimited: allNet && unlimitedCalls ? true : undefined,
      textsUnlimited: allNet && unlimitedTexts ? true : undefined,
      // Compatibility is left unknown: "5G" in the copy describes bonus data,
      // not a verified handset requirement (AGENTS.md section 14).
    });
  });

  return { drafts, warnings };
}

export const ditoCollector: ProviderCollector = {
  providerId: "dito",
  sourceUrls: [DITO_PROMO_URL],
  async collect({ fetchPage, logger }) {
    const page = await fetchPage(DITO_PROMO_URL);
    if (page.status !== 200) {
      throw new Error(`DITO promo page returned HTTP ${page.status}`);
    }

    logger.info("DITO: parsing promo page", { url: page.url, bytes: page.body.length });
    return parseDitoPromos(page.body);
  },
};
