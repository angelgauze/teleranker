import type { OverrideCandidate, OverrideSet } from "../db/repository";
import type { PromoCompatibility } from "../schema/promo";
import { promoOverrideSchema, type PromoOverride } from "../schema/override";
import { parseCsvRecords, toCsv } from "./csv";
import { checkVerifiedDate, manilaDate, mapCompatibility, parseVerifiedDate } from "./promo-sheet";

/**
 * The override sheet: values a person checked on a provider's page, applied
 * on top of that provider's collected promos (see src/lib/overrides/apply.ts).
 *
 * The template is generated from the published promos with the promo IDs and
 * details filled in; a person only fills network_support, verified_at,
 * source_url and an optional note for the promos they checked. Rows left
 * blank in network_support are ignored. A provider with any row in the file
 * has its overrides replaced by the file's, so deleting a row removes that
 * override. Providers not in the file are left alone.
 */

/** Columns the import reads. The others are there to help the person filling it in. */
export const OVERRIDE_REQUIRED_COLUMNS = [
  "provider",
  "promo_id",
  "network_support",
  "verified_at",
  "source_url",
  "note",
] as const;

export const OVERRIDE_TEMPLATE_COLUMNS = [
  "provider",
  "promo_id",
  "name",
  "price_php",
  "data",
  "validity",
  "shown_now",
  "network_support",
  "verified_at",
  "source_url",
  "note",
] as const;

export interface OverrideRowError {
  line: number;
  promoId: string;
  errors: string[];
}

export type OverrideSheetResult =
  | { ok: true; providers: OverrideSet[] }
  | { ok: false; fileErrors: string[]; rowErrors: OverrideRowError[] };

/**
 * Validates a whole override sheet. Nothing is returned for writing unless
 * every row is valid. `overridableProviders` are the providers whose promos are
 * collected automatically: hand-entered providers already carry their checked
 * values in the main promo sheet.
 */
export function validateOverrideSheet(
  csvText: string,
  overridableProviders: ReadonlySet<string>,
  now: Date = new Date(),
): OverrideSheetResult {
  const rowErrors: OverrideRowError[] = [];

  let parsed: ReturnType<typeof parseCsvRecords>;
  try {
    parsed = parseCsvRecords(csvText);
  } catch (error) {
    return {
      ok: false,
      fileErrors: [error instanceof Error ? error.message : "could not parse the CSV"],
      rowErrors,
    };
  }

  const missing = OVERRIDE_REQUIRED_COLUMNS.filter((column) => !parsed.header.includes(column));
  if (missing.length > 0) {
    return { ok: false, fileErrors: [`missing columns: ${missing.join(", ")}`], rowErrors };
  }
  if (parsed.records.length === 0) {
    return { ok: false, fileErrors: ["the sheet has no rows"], rowErrors };
  }

  const byProvider = new Map<string, PromoOverride[]>();
  const seen = new Map<string, number>();

  for (const { values, line } of parsed.records) {
    const providerId = values.provider ?? "";
    const promoId = values.promo_id ?? "";
    const errors: string[] = [];

    if (!providerId) errors.push("provider is required");
    else if (!overridableProviders.has(providerId)) {
      errors.push(
        `provider "${providerId}" cannot take overrides: only automatically collected providers can (${[...overridableProviders].join(", ")})`,
      );
    }
    if (!promoId) errors.push("promo_id is required");

    const seenKey = `${providerId}/${promoId}`;
    const firstLine = seen.get(seenKey);
    if (promoId && firstLine !== undefined) {
      errors.push(`duplicate promo_id (first used on line ${firstLine})`);
    }
    if (promoId) seen.set(seenKey, firstLine ?? line);

    const override = errors.length === 0 ? mapOverrideRow(providerId, promoId, values, now, errors) : null;

    if (errors.length > 0) {
      rowErrors.push({ line, promoId, errors });
      continue;
    }

    // A provider with any row is replaced as a whole, even if every row is blank.
    const list = byProvider.get(providerId) ?? [];
    if (override) list.push(override);
    byProvider.set(providerId, list);
  }

  if (rowErrors.length > 0) return { ok: false, fileErrors: [], rowErrors };

  return {
    ok: true,
    providers: [...byProvider.entries()].map(([providerId, overrides]) => ({ providerId, overrides })),
  };
}

/** Null for a row left blank in network_support (not checked yet). */
function mapOverrideRow(
  providerId: string,
  promoId: string,
  values: Record<string, string>,
  now: Date,
  errors: string[],
): PromoOverride | null {
  const networkSupport = values.network_support ?? "";
  if (!networkSupport) return null;

  const compatibility = mapCompatibility(networkSupport, errors);

  const rawDate = values.verified_at ?? "";
  const verifiedAt = parseVerifiedDate(rawDate);
  if (!verifiedAt) {
    errors.push(`verified_at must be a YYYY-MM-DD date (got "${rawDate}")`);
  } else {
    const problem = checkVerifiedDate(rawDate, verifiedAt, now, "verified_at");
    if (problem) errors.push(problem);
  }

  const sourceUrl = values.source_url ?? "";
  if (!sourceUrl) errors.push("source_url is required: the page where the value was checked");
  else if (!sourceUrl.startsWith("https://")) errors.push("source_url must start with https://");

  if (errors.length > 0) return null;

  const parsed = promoOverrideSchema.safeParse({
    providerId,
    externalKey: promoId,
    compatibility,
    verifiedAt,
    sourceUrl,
    note: values.note || undefined,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
    }
    return null;
  }
  return parsed.data;
}

const NETWORK_SUPPORT: Record<PromoCompatibility, string> = {
  FOUR_G: "4G",
  FOUR_G_AND_FIVE_G: "4G/5G",
  FIVE_G: "5G",
  UNKNOWN: "",
};

const SHOWN: Record<PromoCompatibility, string> = {
  FOUR_G: "4G only",
  FOUR_G_AND_FIVE_G: "4G and 5G",
  FIVE_G: "5G only",
  UNKNOWN: "Not verified",
};

function describeData(candidate: OverrideCandidate): string {
  switch (candidate.dataKind) {
    case "TOTAL":
      return candidate.dataGb ? `${candidate.dataGb} GB` : "Unknown";
    case "UNLIMITED":
      return "Unlimited";
    case "NONE":
      return "None";
    default:
      return "Unknown";
  }
}

function describeValidity(candidate: OverrideCandidate): string {
  if (candidate.noExpiry) return "No expiry";
  if (!candidate.validityValue || !candidate.validityUnit) return "Unknown";
  const unit = candidate.validityUnit.toLowerCase();
  return `${candidate.validityValue} ${unit}${candidate.validityValue === 1 ? "" : "s"}`;
}

/**
 * The override sheet for one provider: one row per published promo, with any
 * stored override already filled in, then any stored override whose promo is
 * no longer published (so re-importing never drops it without a person seeing
 * it). `fallbackSourceUrl` (the provider's promo page) pre-fills source_url for
 * promos without a page of their own: it is where the value would be checked.
 */
export function buildOverrideTemplate(options: {
  providerId: string;
  candidates: readonly OverrideCandidate[];
  overrides: readonly PromoOverride[];
  fallbackSourceUrl?: string;
}): string {
  const { providerId, candidates, overrides } = options;
  const stored = new Map(overrides.map((override) => [override.externalKey, override]));
  const rows: string[][] = [[...OVERRIDE_TEMPLATE_COLUMNS]];

  const sorted = [...candidates].sort(
    (a, b) => a.priceCentavos - b.priceCentavos || a.name.localeCompare(b.name),
  );
  for (const candidate of sorted) {
    const override = stored.get(candidate.externalKey);
    stored.delete(candidate.externalKey);
    rows.push([
      providerId,
      candidate.externalKey,
      candidate.name,
      (candidate.priceCentavos / 100).toFixed(2),
      describeData(candidate),
      describeValidity(candidate),
      SHOWN[candidate.compatibility],
      override ? NETWORK_SUPPORT[override.compatibility] : "",
      override ? manilaDate(override.verifiedAt) : "",
      override?.sourceUrl ?? candidate.sourceUrl ?? options.fallbackSourceUrl ?? "",
      override?.note ?? "",
    ]);
  }

  for (const override of stored.values()) {
    rows.push([
      providerId,
      override.externalKey,
      "(no longer published)",
      "",
      "",
      "",
      "",
      NETWORK_SUPPORT[override.compatibility],
      manilaDate(override.verifiedAt),
      override.sourceUrl,
      override.note ?? "",
    ]);
  }

  return toCsv(rows);
}
