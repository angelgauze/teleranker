import type { DataAllocationKind, ValidityUnit } from "../schema/promo";

/**
 * Text normalisation helpers shared by every provider collector.
 *
 * Provider pages encode the same facts in different ways ("₱99", "P99",
 * "PHP 99"), so parsing lives here and collectors only supply the text.
 * Anything that cannot be parsed returns `null` - callers must treat that as
 * "unknown", never as zero.
 */

export function collapseWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** "₱1,299.50" -> 129950. Returns null when the text has no price. */
export function parsePriceToCentavos(input: string): number | null {
  const text = collapseWhitespace(input);
  const match = text.match(/(?:₱|PHP|P)\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export interface ParsedData {
  kind: DataAllocationKind;
  /** Only set when kind is TOTAL. */
  gb?: number;
  /** The raw phrase that produced this result, for traceability. */
  raw: string;
}

const DATA_SIZE_PATTERN = /(\d+(?:\.\d+)?)\s*(TB|GB|MB)\b/i;

export function parseDataAllocation(input: string): ParsedData | null {
  const text = collapseWhitespace(input);
  if (!text) {
    return null;
  }

  const size = text.match(DATA_SIZE_PATTERN);
  if (size) {
    const value = Number(size[1]);
    const unit = size[2].toUpperCase();
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    const gb = unit === "TB" ? value * 1024 : unit === "MB" ? value / 1024 : value;
    return {
      kind: "TOTAL",
      gb: Math.round(gb * 100) / 100,
      raw: text,
    };
  }

  if (/\bunlimited\b|\bunli\b/i.test(text)) {
    return { kind: "UNLIMITED", raw: text };
  }

  return null;
}

export interface ParsedValidity {
  value: number;
  unit: ValidityUnit;
  raw: string;
}

const VALIDITY_UNITS: Record<string, ValidityUnit> = {
  day: "DAY",
  days: "DAY",
  week: "WEEK",
  weeks: "WEEK",
  month: "MONTH",
  months: "MONTH",
};

/** "Valid for 7 days" -> { value: 7, unit: "DAY" }. */
export function parseValidity(input: string): ParsedValidity | null {
  const text = collapseWhitespace(input);
  const match = text.match(/(\d+)\s*(day|days|week|weeks|month|months)\b/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = VALIDITY_UNITS[match[2].toLowerCase()];
  if (!Number.isInteger(value) || value <= 0 || !unit) {
    return null;
  }

  return { value, unit, raw: text };
}

/** Stable, URL-safe key derived from a promo name. */
export function slugify(input: string): string {
  return collapseWhitespace(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Cuts text to a maximum length without splitting a word when avoidable. */
export function truncate(input: string, maxLength: number): string {
  const text = collapseWhitespace(input);
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body}…`;
}
