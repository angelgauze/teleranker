/**
 * The site header's page links, in order. Compare is not one: it opens from
 * the listing once two promos are picked (direct /compare links still work).
 */
export const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Promos" },
  { href: "/providers", label: "Providers" },
  { href: "/plan", label: "Plan" },
];

/** True when `pathname` is the link's page or a page under it ("/" matches only itself). */
export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
