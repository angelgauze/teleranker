import { parsePesoAmount } from "../money";
import { promoInputSchema, type PromoInput, type PromoStatus } from "../schema/promo";
import type { CsvRecord } from "./csv";

/**
 * Maps one row of the team's manual promo sheet to a validated PromoInput.
 *
 * The sheet's column guide (its "Read me" tab) defines what each column means.
 * Only the columns the site needs are read; contributor names
 * (verified_by, entered_by), app perks, fair-use figures and the sheet's own
 * row check are ignored on purpose.
 *
 * Mapping decisions (team, 2026-11-20; see docs/providers.md):
 * - Provider = brand_id (what the customer sees: smart, tnt, globe, gomo, ...).
 * - Data: unlimited -> UNLIMITED; open_gb blank -> UNKNOWN; open + app = 0 ->
 *   NONE; otherwise TOTAL with dataGb = open + app and, when app data exists,
 *   allAccessGb = open so app-locked data cannot inflate the value score.
 * - Validity: is_no_expiry = yes -> noExpiry; validity_days -> DAY; blank ->
 *   unknown.
 * - 4G/5G by phone compatibility: "5G" (needs a 5G device) -> FIVE_G; "4G" and
 *   "4G/5G" work on any LTE phone -> FOUR_G_AND_FIVE_G; blank -> UNKNOWN.
 * - Calls/texts: unli_allnet -> unlimited; none -> 0; limited -> limited with
 *   the stated minutes (texts have no count column, so the count stays
 *   unknown); unli_onnet and blank -> unknown, because the model cannot say
 *   "unlimited on one network only" and must not overstate it.
 */

export const REQUIRED_COLUMNS = [
  "promo_id",
  "brand_id",
  "promo_name",
  "price_php",
  "open_gb",
  "app_gb",
  "is_unlimited_data",
  "validity_days",
  "is_no_expiry",
  "network_support",
  "calls",
  "calls_minutes",
  "texts",
  "source_url",
  "source_type",
  "status",
  "last_verified_at",
  "notes",
] as const;

export type SheetRowResult =
  | { ok: true; promo: PromoInput }
  | { ok: false; line: number; promoId: string; errors: string[] };

const DECIMAL = /^\d+(?:\.\d+)?$/;
const WHOLE = /^\d+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Excel stores dates as days since 1899-12-30. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function yesNo(value: string, column: string, errors: string[]): boolean {
  const normalised = value.toLowerCase();
  if (normalised === "yes") return true;
  if (normalised === "no" || normalised === "") return false;
  errors.push(`${column} must be yes or no (got "${value}")`);
  return false;
}

function decimal(value: string, column: string, errors: string[]): number | undefined {
  if (value === "") return undefined;
  if (!DECIMAL.test(value)) {
    errors.push(`${column} must be a number (got "${value}")`);
    return undefined;
  }
  return Number(value);
}

function whole(value: string, column: string, errors: string[]): number | undefined {
  if (value === "") return undefined;
  if (!WHOLE.test(value)) {
    errors.push(`${column} must be a whole number (got "${value}")`);
    return undefined;
  }
  return Number(value);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Earliest verification date the import accepts (catches mistyped serials). */
export const EARLIEST_VERIFIED_DATE = "2020-01-01";

/** Calendar date (YYYY-MM-DD) of an instant in Manila (UTC+8). */
const manilaDate = (date: Date) => new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

/**
 * Checks a verification date is plausible: not before 2020-01-01 and not
 * after the day of the import (Manila time). A future date would keep a promo
 * from ever showing as outdated.
 */
export function checkVerifiedDate(raw: string, date: Date, now: Date): string | undefined {
  const day = manilaDate(date);
  const shown = day === raw ? raw : `${raw} (${day})`;
  if (day < EARLIEST_VERIFIED_DATE) {
    return `last_verified_at ${shown} is before ${EARLIEST_VERIFIED_DATE}`;
  }
  if (day > manilaDate(now)) return `last_verified_at ${shown} is in the future`;
  return undefined;
}

/** Midnight in Manila (UTC+8) on the given calendar date. */
export function parseVerifiedDate(value: string): Date | undefined {
  const iso = ISO_DATE.exec(value);
  if (iso) {
    const [, year, month, day] = iso;
    const date = new Date(`${year}-${month}-${day}T00:00:00+08:00`);
    const check = new Date(date.getTime() + 8 * 3600_000);
    return check.getUTCDate() === Number(day) && check.getUTCMonth() + 1 === Number(month)
      ? date
      : undefined;
  }

  if (/^\d{5}(?:\.0+)?$/.test(value)) {
    const serial = Number(value);
    const utc = new Date(EXCEL_EPOCH_MS + serial * 86_400_000);
    return new Date(`${utc.toISOString().slice(0, 10)}T00:00:00+08:00`);
  }

  return undefined;
}

function mapData(values: Record<string, string>, errors: string[]): Partial<PromoInput> {
  const unlimited = yesNo(values.is_unlimited_data, "is_unlimited_data", errors);
  const open = decimal(values.open_gb, "open_gb", errors);
  const app = decimal(values.app_gb, "app_gb", errors) ?? 0;

  if (unlimited) {
    if (open !== undefined) errors.push("open_gb must be blank when is_unlimited_data is yes");
    return { dataKind: "UNLIMITED" };
  }

  if (open === undefined) return { dataKind: "UNKNOWN" };
  if (open === 0 && app === 0) return { dataKind: "NONE" };
  if (open === 0) {
    errors.push("app-only data (open_gb 0, app_gb > 0) cannot be represented yet");
    return { dataKind: "UNKNOWN" };
  }

  return app > 0
    ? { dataKind: "TOTAL", dataGb: round2(open + app), allAccessGb: round2(open) }
    : { dataKind: "TOTAL", dataGb: round2(open) };
}

function mapValidity(values: Record<string, string>, errors: string[]): Partial<PromoInput> {
  const noExpiry = yesNo(values.is_no_expiry, "is_no_expiry", errors);
  const days = whole(values.validity_days, "validity_days", errors);

  if (noExpiry) {
    if (days !== undefined) errors.push("validity_days must be blank when is_no_expiry is yes");
    return { noExpiry: true };
  }
  if (days === undefined) return {};
  if (days <= 0) {
    errors.push("validity_days must be greater than 0");
    return {};
  }
  return { validityValue: days, validityUnit: "DAY" };
}

function mapCompatibility(value: string, errors: string[]): PromoInput["compatibility"] {
  switch (value.toUpperCase()) {
    case "5G":
      return "FIVE_G";
    case "4G":
    case "4G/5G":
      return "FOUR_G_AND_FIVE_G";
    case "":
      return "UNKNOWN";
    default:
      errors.push(`network_support must be 4G, 4G/5G or 5G (got "${value}")`);
      return "UNKNOWN";
  }
}

function mapCalls(values: Record<string, string>, errors: string[]): Partial<PromoInput> {
  switch (values.calls) {
    case "unli_allnet":
      return { callsUnlimited: true };
    case "none":
      return { callsUnlimited: false, callsIncluded: 0 };
    case "limited":
      return {
        callsUnlimited: false,
        callsIncluded: whole(values.calls_minutes, "calls_minutes", errors),
      };
    case "unli_onnet":
    case "":
      return {};
    default:
      errors.push(`calls has an unknown value "${values.calls}"`);
      return {};
  }
}

function mapTexts(value: string, errors: string[]): Partial<PromoInput> {
  switch (value) {
    case "unli_allnet":
      return { textsUnlimited: true };
    case "none":
      return { textsUnlimited: false, textsIncluded: 0 };
    case "limited":
      return { textsUnlimited: false };
    case "unli_onnet":
    case "":
      return {};
    default:
      errors.push(`texts has an unknown value "${value}"`);
      return {};
  }
}

/** `now` is the moment of the import; verification dates may not be after it. */
export function mapSheetRow(record: CsvRecord, now: Date = new Date()): SheetRowResult {
  const { values, line } = record;
  const errors: string[] = [];
  const promoId = values.promo_id ?? "";

  if (!promoId) errors.push("promo_id is required");
  if (!values.brand_id) errors.push("brand_id is required");

  // Accepts "1299", "1,299.00", "₱1,299" and so on; see src/lib/money.ts.
  const parsedPrice = parsePesoAmount(values.price_php ?? "");
  const priceCentavos = parsedPrice ?? 0;
  if (parsedPrice === null) {
    errors.push(`price_php must be a peso amount such as 1299 or 1,299.00 (got "${values.price_php ?? ""}")`);
  } else if (parsedPrice <= 0) {
    errors.push("price_php must be greater than 0");
  }

  const status = (values.status ?? "").toUpperCase() as PromoStatus;
  const lastVerifiedAt = parseVerifiedDate(values.last_verified_at ?? "");
  if (!lastVerifiedAt) {
    errors.push(`last_verified_at must be a YYYY-MM-DD date (got "${values.last_verified_at ?? ""}")`);
  } else {
    const problem = checkVerifiedDate(values.last_verified_at ?? "", lastVerifiedAt, now);
    if (problem) errors.push(problem);
  }

  const sourceUrl = values.source_url || undefined;
  if (sourceUrl && !sourceUrl.startsWith("https://")) {
    errors.push("source_url must start with https://");
  }

  const candidate = {
    providerId: values.brand_id,
    externalKey: promoId,
    name: values.promo_name,
    description: values.notes || undefined,
    priceCentavos,
    ...mapData(values, errors),
    ...mapValidity(values, errors),
    compatibility: mapCompatibility(values.network_support ?? "", errors),
    ...mapCalls(values, errors),
    ...mapTexts(values.texts ?? "", errors),
    status,
    sourceUrl,
    lastVerifiedAt,
    sourceMetadata: {
      entry: "manual-import",
      ...(values.source_type ? { sourceType: values.source_type } : {}),
    },
  };

  const parsed = promoInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.map(String).join(".") || "record"}: ${issue.message}`);
    }
  }

  if (errors.length > 0 || !parsed.success) {
    return { ok: false, line, promoId, errors: [...new Set(errors)] };
  }
  return { ok: true, promo: parsed.data };
}
