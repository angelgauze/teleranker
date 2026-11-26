import Link from "next/link";
import { NAV_ITEMS } from "@/lib/ui/nav";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

/** Site name and main navigation, shown on every page. */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-3 sm:gap-x-4 sm:px-6">
        <Link
          href="/"
          aria-label="TeleRanker home"
          className="rounded focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {/* Shrinks with the screen so the links always fit beside it (26 px from ~430 px wide). */}
          <Logo size="clamp(12px, calc((100vw - 250px) * 0.145), 26px)" />
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center sm:gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} label={item.label} />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
