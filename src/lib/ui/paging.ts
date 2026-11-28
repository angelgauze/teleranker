/**
 * The listing shows promos in batches. Filters and sorting always run on every
 * promo first; the batch size only limits how many results are rendered.
 */

/** Promos per batch: divides evenly into the two-column tablet grid. */
export const PAGE_SIZE = 24;

/** Upper bound for `?show=`, so a crafted address cannot ask for an unbounded page. */
const MAX_SHOWN = PAGE_SIZE * 100;

/** How many promos to show for a `?show=` value: whole batches, at least one. */
export function parseShowCount(raw: string | undefined): number {
  if (!raw || !/^\d{1,6}$/.test(raw)) return PAGE_SIZE;
  const requested = Number(raw);
  if (requested <= 0) return PAGE_SIZE;
  return Math.min(Math.ceil(requested / PAGE_SIZE) * PAGE_SIZE, MAX_SHOWN);
}

/** The current filters, every value of a repeated one (several providers), without `show`. */
function filterQuery(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === "show") continue;
    for (const one of Array.isArray(value) ? value : [value]) if (one) query.append(name, one);
  }
  return query;
}

/** The listing address with the same filters and one more batch shown. */
export function showMoreHref(
  params: Record<string, string | string[] | undefined>,
  shown: number,
): string {
  const query = filterQuery(params);
  query.set("show", String(shown + PAGE_SIZE));
  return `/?${query.toString()}`;
}
