import type { PromoInput, PromoOrigin } from "../schema/promo";

/**
 * Collected and hand-entered promos are listed side by side. When the same
 * promo is in both (same provider, same name, same price), only one is shown:
 * the one checked most recently. The other stays in the database.
 *
 * Names are compared without case, spaces or punctuation, so "Go+ 109" and
 * "GO+109" match. A price difference means a different promo (or a changed
 * one), so both stay listed.
 */

export interface ListedEntry {
  origin: PromoOrigin;
  promo: Pick<PromoInput, "providerId" | "name" | "priceCentavos" | "status" | "lastVerifiedAt">;
}

export function duplicateKey(promo: ListedEntry["promo"]): string {
  const name = promo.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${promo.providerId}|${name}|${promo.priceCentavos}`;
}

/** True when two listed rows are copies of one promo (same provider, name and price). */
export function isSamePromo(a: ListedEntry["promo"], b: ListedEntry["promo"]): boolean {
  return duplicateKey(a) === duplicateKey(b);
}

/** Listed promos rank above "no longer offered" ones, then the newest check wins; collected wins a tie. */
function rank(entry: ListedEntry): [number, number, number] {
  return [
    entry.promo.status === "UNAVAILABLE" ? 0 : 1,
    entry.promo.lastVerifiedAt?.getTime() ?? Number.NEGATIVE_INFINITY,
    entry.origin === "COLLECTED" ? 1 : 0,
  ];
}

function outranks(a: ListedEntry, b: ListedEntry): boolean {
  const [x, y] = [rank(a), rank(b)];
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/**
 * Drops the losing source's copies of promos that both sources list. Promos
 * found in one source only are always kept, and the input order is preserved.
 */
export function hideDuplicates<T extends ListedEntry>(entries: T[]): T[] {
  const best = new Map<string, T>();
  const origins = new Map<string, Set<PromoOrigin>>();
  for (const entry of entries) {
    const key = duplicateKey(entry.promo);
    origins.set(key, (origins.get(key) ?? new Set()).add(entry.origin));
    const current = best.get(key);
    if (!current || outranks(entry, current)) best.set(key, entry);
  }
  return entries.filter((entry) => {
    const key = duplicateKey(entry.promo);
    return origins.get(key)!.size === 1 || entry.origin === best.get(key)!.origin;
  });
}
