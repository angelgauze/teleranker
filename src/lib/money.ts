/**
 * Peso amounts: one way in, one way out.
 *
 * Stored: integer centavos (₱1,299.50 -> 129950), never floats.
 *
 * Written (spreadsheet cells, admin input): a single amount, optionally
 * prefixed with ₱, PHP or P, with or without correctly grouped thousands
 * separators, and at most two decimal places. All of these are ₱1,299.00:
 * "1299", "1299.00", "1,299", "1,299.00", "₱1,299", "PHP 1,299.00".
 * Anything else (text, negative numbers, misplaced commas such as "1,29")
 * is rejected rather than guessed.
 *
 * Displayed: see formatPeso in src/lib/ui/format.ts.
 */

const PESO_AMOUNT = /^(?:₱|PHP|P)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/i;

/** Parses one peso amount into centavos, or returns null when it is not one. */
export function parsePesoAmount(input: string): number | null {
  const match = PESO_AMOUNT.exec(input.trim());
  if (!match) return null;

  const pesos = Number(match[1].replace(/,/g, ""));
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  const total = pesos * 100 + centavos;
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Highest budget the listing filter accepts: ₱1,000,000. A safety bound far
 * above any prepaid promo and well inside the database's 32-bit integer
 * column (about ₱21.4 million), not a product rule.
 */
export const MAX_BUDGET_CENTAVOS = 100_000_000;

export type BudgetResult =
  | { ok: true; centavos?: number }
  | { ok: false; error: string };

/**
 * Parses a budget field from the listing filter with the same rules as
 * parsePesoAmount ("99", "1,299", "₱1,299.50"). Blank means no limit.
 * Unreadable or out-of-range values are reported, never guessed.
 */
export function parseBudget(input: string | undefined, label: string): BudgetResult {
  const text = input?.trim() ?? "";
  if (text === "") return { ok: true };

  const centavos = parsePesoAmount(text);
  if (centavos === null || centavos > MAX_BUDGET_CENTAVOS) {
    return { ok: false, error: `${label} must be a peso amount up to ₱1,000,000.` };
  }
  return { ok: true, centavos };
}

export interface BudgetRange {
  minCentavos?: number;
  maxCentavos?: number;
  /** Plain-language problems to show next to the filter. */
  errors: string[];
  /** Which fields were rejected, for aria-invalid. */
  invalid: { min: boolean; max: boolean };
}

/**
 * Reads the listing's min/max budget fields. A rejected field is ignored
 * (no limit) and explained; a minimum above the maximum drops both bounds
 * with a note, rather than showing an empty list.
 */
export function parseBudgetRange(min: string | undefined, max: string | undefined): BudgetRange {
  const lower = parseBudget(min, "Min budget");
  const upper = parseBudget(max, "Max budget");
  const errors: string[] = [];
  if (!lower.ok) errors.push(lower.error);
  if (!upper.ok) errors.push(upper.error);

  const minCentavos = lower.ok ? lower.centavos : undefined;
  const maxCentavos = upper.ok ? upper.centavos : undefined;

  if (minCentavos !== undefined && maxCentavos !== undefined && minCentavos > maxCentavos) {
    return {
      errors: ["Min budget is higher than max budget, so no budget limit was applied."],
      invalid: { min: true, max: true },
    };
  }

  return { minCentavos, maxCentavos, errors, invalid: { min: !lower.ok, max: !upper.ok } };
}
