"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentPath } from "@/lib/ui/nav";

/**
 * A header link. The current page gets aria-current, a filled tab and a
 * heavier weight, so it never relies on colour alone. `block` is the phone
 * menu's full-width row.
 */
export function NavLink({ href, label, block = false }: { href: string; label: string; block?: boolean }) {
  const current = isCurrentPath(usePathname() ?? "/", href);

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex items-center rounded-lg text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 ${
        block ? "min-h-11 px-3" : "h-9 px-3"
      } ${current ? "bg-selected font-[590] text-fg" : "font-medium text-fg-3 hover:bg-raised hover:text-fg"}`}
    >
      {label}
    </Link>
  );
}
