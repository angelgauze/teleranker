import { z } from "zod";
import type { PromoCompatibility } from "../schema/promo";
import type { ScoredPromo } from "../ranking/value";

/**
 * Compare phases 2 and 3: the visitor's own phone and needs, read from the
 * address (`?phone=4g&days=30&daily=1.5&budget=500`). Nothing is stored.
 */

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// ---------------------------------------------------------------------------
// Phase 2: "My phone is 4G only"

export function isFourGOnlyPhone(params: Params): boolean {
  return first(params.phone) === "4g";
}

/**
 * Whether a promo works on a 4G-only phone, in one or two words.
 * Compatibility is phone compatibility (CLAUDE.md): `FIVE_G` needs a 5G phone.
 */
export function fourGPhoneSupport(compatibility: PromoCompatibility): string {
  if (compatibility === "FIVE_G") return "Unsupported";
  if (compatibility === "UNKNOWN") return "Not verified";
  return "Supported";
}

// ---------------------------------------------------------------------------
// Phase 3: "Plan for my needs"

export const NEEDS_LIMITS = {
  days: { min: 1, max: 365 },
  dailyGb: { min: 0.1, max: 50 },
  budgetPhp: { min: 1, max: 100_000 },
} as const;

/** Blank fields are "not given"; anything else must be a number in range. */
const optionalNumber = (min: number, max: number, integer: boolean) =>
  z
    .string()
    .trim()
    .transform((raw) => (raw === "" ? undefined : Number(raw)))
    .pipe(
      (integer ? z.number().int() : z.number())
        .min(min)
        .max(max)
        .optional(),
    );

export const needsSchema = z.object({
  days: optionalNumber(NEEDS_LIMITS.days.min, NEEDS_LIMITS.days.max, true),
  dailyGb: optionalNumber(NEEDS_LIMITS.dailyGb.min, NEEDS_LIMITS.dailyGb.max, false),
  budgetPhp: optionalNumber(NEEDS_LIMITS.budgetPhp.min, NEEDS_LIMITS.budgetPhp.max, true),
});

export interface Needs {
  days: number;
  dailyGb?: number;
  budgetPhp?: number;
}

export type NeedsResult =
  | { state: "none" }
  | { state: "invalid"; message: string }
  | { state: "ok"; needs: Needs };

/** The raw form values, so the form can show what was typed. */
export function rawNeeds(params: Params) {
  return {
    days: first(params.days) ?? "",
    daily: first(params.daily) ?? "",
    budget: first(params.budget) ?? "",
  };
}

export function parseNeeds(params: Params): NeedsResult {
  const raw = rawNeeds(params);
  if (!raw.days.trim() && !raw.daily.trim() && !raw.budget.trim()) return { state: "none" };

  const parsed = needsSchema.safeParse({ days: raw.days, dailyGb: raw.daily, budgetPhp: raw.budget });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const { days, dailyGb, budgetPhp } = NEEDS_LIMITS;
    const message =
      field === "days"
        ? `Days must be a whole number from ${days.min} to ${days.max}.`
        : field === "dailyGb"
          ? `Daily data must be from ${dailyGb.min} to ${dailyGb.max} GB.`
          : `Budget must be a whole peso amount from ₱${budgetPhp.min} to ₱${budgetPhp.max.toLocaleString("en-PH")}.`;
    return { state: "invalid", message };
  }

  const { days, dailyGb, budgetPhp } = parsed.data;
  if (days === undefined) return { state: "invalid", message: "Enter how many days you need." };
  return { state: "ok", needs: { days, dailyGb, budgetPhp } };
}

export type Plan =
  | { state: "cannot"; reason: string }
  | {
      state: "ok";
      /** How many times the promo is bought, one after another. */
      buys: number;
      totalCentavos: number;
      /** All-access GB across all buys; null when the data is unlimited. */
      totalGb: number | null;
      unlimitedData: boolean;
      /** Whether the total fits the budget; null when no budget was given. */
      fitsBudget: boolean | null;
      /** Centavos left (positive) or over (negative); null without a budget. */
      budgetGapCentavos: number | null;
    };

/**
 * How a promo covers the visitor's needs, bought again each time it expires
 * or its data runs out (assumption: unused data does not carry over, and
 * only all-access data counts). Rounds the number of buys up, so the plan
 * always covers every day. Unknown values are never guessed.
 */
export function planForNeeds({ promo, metrics }: ScoredPromo, needs: Needs): Plan {
  if (!(promo.priceCentavos > 0)) return { state: "cannot", reason: "the price is unknown" };

  const validityDays = promo.noExpiry ? null : metrics.validityDays;
  if (!promo.noExpiry && validityDays === null) {
    return { state: "cannot", reason: "its validity is unknown" };
  }
  const buysForDays = validityDays === null ? 1 : Math.ceil(needs.days / validityDays);

  const unlimitedData = promo.dataKind === "UNLIMITED";
  let buysForData = 1;

  if (needs.dailyGb !== undefined) {
    if (unlimitedData) {
      // Any buy covers the usage.
    } else if (promo.dataKind === "NONE") {
      return { state: "cannot", reason: "it includes no data" };
    } else if (metrics.comparableGb === null || metrics.comparableGb <= 0) {
      return { state: "cannot", reason: "its data amount is unknown" };
    } else {
      const neededGb = needs.days * needs.dailyGb;
      // A tiny tolerance so 3 × 0.1 GB counts as 0.3 GB, not just over it.
      buysForData = Math.ceil(neededGb / metrics.comparableGb - 1e-9);
    }
  }

  const buys = Math.max(buysForDays, buysForData, 1);
  const totalCentavos = buys * promo.priceCentavos;
  const totalGb =
    unlimitedData || metrics.comparableGb === null ? null : Math.round(buys * metrics.comparableGb * 100) / 100;
  const budgetCentavos = needs.budgetPhp === undefined ? null : needs.budgetPhp * 100;

  return {
    state: "ok",
    buys,
    totalCentavos,
    totalGb,
    unlimitedData,
    fitsBudget: budgetCentavos === null ? null : totalCentavos <= budgetCentavos,
    budgetGapCentavos: budgetCentavos === null ? null : budgetCentavos - totalCentavos,
  };
}
