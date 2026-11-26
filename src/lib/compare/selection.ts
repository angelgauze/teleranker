/**
 * The promos a visitor has picked to compare. Pure rules here; the browser
 * keeps the picks for the open tab only (see src/app/_components/compare-store.ts),
 * so nothing is stored on our side.
 */

/** Comparing means exactly two promos (AGENTS.md: no more than two). */
export const MAX_PICKS = 2;

export interface PickedPromo {
  id: string;
  name: string;
}

/** Picks or unpicks a promo. A third pick is refused and the first two are kept. */
export function togglePick(
  picks: readonly PickedPromo[],
  item: PickedPromo,
): { picks: PickedPromo[]; refused: boolean } {
  if (picks.some((pick) => pick.id === item.id)) {
    return { picks: picks.filter((pick) => pick.id !== item.id), refused: false };
  }
  if (picks.length >= MAX_PICKS) return { picks: [...picks], refused: true };
  return { picks: [...picks, item], refused: false };
}

/** Reads saved picks, ignoring anything malformed, duplicated or past the limit. */
export function parsePicks(raw: string | null): PickedPromo[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const picks: PickedPromo[] = [];
  for (const entry of value) {
    if (picks.length >= MAX_PICKS) break;
    const { id, name } = (entry ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof name !== "string") continue;
    if (picks.some((pick) => pick.id === id)) continue;
    picks.push({ id, name });
  }
  return picks;
}

/** The compare page for the picked promos. */
export function compareHref(picks: readonly PickedPromo[]): string {
  const query = new URLSearchParams();
  for (const pick of picks) query.append("id", pick.id);
  return `/compare?${query.toString()}`;
}
