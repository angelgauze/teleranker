/** The site header's links, in order. */
export const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Promos" },
  { href: "/providers", label: "Providers" },
  { href: "/compare", label: "Compare" },
];

/** True when `pathname` is the link's page or a page under it ("/" matches only itself). */
export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
