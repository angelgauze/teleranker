import type { PromoRepository, ProviderSeed } from "../db/repository";
import type { PromoInput } from "../schema/promo";
import { parseCsvRecords } from "./csv";
import { mapSheetRow, REQUIRED_COLUMNS } from "./promo-sheet";

/**
 * Manual promo import: the fallback for providers that cannot be collected
 * automatically (Smart, TNT, GOMO) and for automated providers whose runs are
 * blocked (Globe while its bot challenge is in place).
 *
 * The whole file is validated first and nothing is written if any row fails,
 * so a half-corrected sheet can never replace published data. Every provider
 * in the file then has its active set replaced (origin MANUAL) in a single
 * transaction: if the database fails part-way, no provider changes. Promos
 * that are no longer in the sheet become UNAVAILABLE rather than deleted.
 *
 * A provider that already has collector-published promos is skipped unless
 * `replaceCollected` is set, so a manual sheet never silently overwrites
 * fresher scraped data.
 */

export interface RowError {
  line: number;
  promoId: string;
  errors: string[];
}

export interface ProviderPlan {
  providerId: string;
  promos: PromoInput[];
}

export type ValidationResult =
  | { ok: true; providers: ProviderPlan[] }
  | { ok: false; fileErrors: string[]; rowErrors: RowError[] };

export function validateSheet(
  csvText: string,
  knownProviders: ReadonlyMap<string, ProviderSeed>,
  now: Date = new Date(),
): ValidationResult {
  const fileErrors: string[] = [];
  const rowErrors: RowError[] = [];

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

  const missing = REQUIRED_COLUMNS.filter((column) => !parsed.header.includes(column));
  if (missing.length > 0) {
    return { ok: false, fileErrors: [`missing columns: ${missing.join(", ")}`], rowErrors };
  }
  if (parsed.records.length === 0) {
    return { ok: false, fileErrors: ["the sheet has no promo rows"], rowErrors };
  }

  const byProvider = new Map<string, PromoInput[]>();
  const seenIds = new Map<string, number>();

  for (const record of parsed.records) {
    const result = mapSheetRow(record, now);
    if (!result.ok) {
      rowErrors.push({ line: result.line, promoId: result.promoId, errors: result.errors });
      continue;
    }

    const { promo } = result;
    const key = promo.externalKey!;
    const firstLine = seenIds.get(key);
    if (firstLine !== undefined) {
      rowErrors.push({
        line: record.line,
        promoId: key,
        errors: [`duplicate promo_id (first used on line ${firstLine})`],
      });
      continue;
    }
    seenIds.set(key, record.line);

    if (!knownProviders.has(promo.providerId)) {
      rowErrors.push({
        line: record.line,
        promoId: key,
        errors: [`brand_id "${promo.providerId}" is not a registered provider`],
      });
      continue;
    }

    const list = byProvider.get(promo.providerId) ?? [];
    list.push(promo);
    byProvider.set(promo.providerId, list);
  }

  if (fileErrors.length > 0 || rowErrors.length > 0) {
    return { ok: false, fileErrors, rowErrors };
  }

  return {
    ok: true,
    providers: [...byProvider.entries()].map(([providerId, promos]) => ({ providerId, promos })),
  };
}

export interface ProviderOutcome {
  providerId: string;
  status: "published" | "skipped";
  published: number;
  markedUnavailable: number;
  reason?: string;
}

export async function publishSheet(options: {
  plans: ProviderPlan[];
  repository: PromoRepository;
  knownProviders: ReadonlyMap<string, ProviderSeed>;
  replaceCollected?: boolean;
}): Promise<ProviderOutcome[]> {
  const skipped: ProviderOutcome[] = [];
  const toPublish: ProviderPlan[] = [];

  // Decide everything first (reads only), then write once.
  for (const plan of options.plans) {
    const collected = await options.repository.countPublished(plan.providerId, "COLLECTED");
    if (collected > 0 && !options.replaceCollected) {
      skipped.push({
        providerId: plan.providerId,
        status: "skipped",
        published: 0,
        markedUnavailable: 0,
        reason: `${collected} collector-published promos are active; pass --replace-collected to replace them`,
      });
    } else {
      toPublish.push(plan);
    }
  }

  // One transaction for every provider: if anything fails, nothing changes.
  const published = toPublish.length
    ? await options.repository.publishMany(
        toPublish.map((plan) => ({
          provider: options.knownProviders.get(plan.providerId)!,
          promos: plan.promos,
          origin: "MANUAL" as const,
        })),
      )
    : [];

  const byId = new Map<string, ProviderOutcome>([
    ...skipped.map((outcome) => [outcome.providerId, outcome] as const),
    ...published.map(
      (summary) => [summary.providerId, { ...summary, status: "published" as const }] as const,
    ),
  ]);
  return options.plans.map((plan) => byId.get(plan.providerId)!);
}
