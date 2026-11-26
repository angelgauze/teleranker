import type { PromoCompatibility, PromoInput } from "../schema/promo";
import type { PromoOverride } from "../schema/override";

/**
 * Applies stored overrides to a collected promo set. Pure: no database.
 *
 * - An override matches a promo by its key (externalKey) and replaces the
 *   promo's compatibility. The checked value always wins.
 * - When the collector found a value of its own that differs, the promo is
 *   listed as a conflict so someone can re-check it.
 * - An override whose promo is not in the set (renamed or removed by the
 *   provider) is listed as unmatched and changes nothing.
 *
 * The number of promos never changes, so the publish safety check sees the
 * same counts with or without overrides.
 */

export interface OverrideConflict {
  externalKey: string;
  collected: PromoCompatibility;
  override: PromoCompatibility;
}

export interface OverrideReport {
  matched: number;
  /** Keys of overrides with no promo in the set. */
  unmatched: string[];
  conflicts: OverrideConflict[];
}

export interface ApplyOverridesResult {
  promos: PromoInput[];
  report: OverrideReport;
  /** What the collector itself published for each matched promo, by key. */
  collected: Map<string, PromoCompatibility>;
}

export function applyOverrides(
  promos: readonly PromoInput[],
  overrides: readonly PromoOverride[],
): ApplyOverridesResult {
  const byKey = new Map(overrides.map((override) => [override.externalKey, override]));
  const used = new Set<string>();
  const conflicts: OverrideConflict[] = [];
  const collected = new Map<string, PromoCompatibility>();

  const applied = promos.map((promo) => {
    const override = promo.externalKey ? byKey.get(promo.externalKey) : undefined;
    if (!override) return promo;

    used.add(override.externalKey);
    collected.set(override.externalKey, promo.compatibility);
    if (promo.compatibility !== "UNKNOWN" && promo.compatibility !== override.compatibility) {
      conflicts.push({
        externalKey: override.externalKey,
        collected: promo.compatibility,
        override: override.compatibility,
      });
    }
    return { ...promo, compatibility: override.compatibility };
  });

  return {
    promos: applied,
    report: {
      matched: used.size,
      unmatched: overrides.map((override) => override.externalKey).filter((key) => !used.has(key)),
      conflicts,
    },
    collected,
  };
}

/** One line for logs and the CLI, e.g. "12 applied, 1 unmatched (data-70), 0 conflicts". */
export function describeOverrideReport(report: OverrideReport): string {
  const unmatched = report.unmatched.length
    ? ` (${report.unmatched.slice(0, 5).join(", ")}${report.unmatched.length > 5 ? ", …" : ""})`
    : "";
  const conflicts = report.conflicts.length
    ? ` (${report.conflicts
        .slice(0, 5)
        .map((conflict) => `${conflict.externalKey}: collector ${conflict.collected}, sheet ${conflict.override}`)
        .join("; ")}${report.conflicts.length > 5 ? "; …" : ""})`
    : "";
  return `${report.matched} applied, ${report.unmatched.length} unmatched${unmatched}, ${report.conflicts.length} conflicts${conflicts}`;
}
