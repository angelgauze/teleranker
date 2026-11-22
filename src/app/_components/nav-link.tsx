"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentPath } from "@/lib/ui/nav";

/**
 * A header link. The current page gets aria-current and an underline, so it
 * never relies on colour alone.
 */
export function NavLink({ href, label }: { href: string; label: string }) {
  const current = isCurrentPath(usePathname() ?? "/", href);

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded px-1 py-1 text-sm font-medium whitespace-nowrap min-[400px]:px-1.5 sm:px-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${
        current ? "underline decoration-2" : "text-zinc-600 dark:text-zinc-400"
      }`}
    >
      {label}
    </Link>
  );
}
