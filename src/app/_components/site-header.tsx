import Link from "next/link";
import { NAV_ITEMS } from "@/lib/ui/nav";
import { HelpMenu } from "./help-menu";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

const MENU_ID = "site-menu";

/** The site's help sections, reachable from every page (each lands on its section). */
const HELP_LINKS = [
  { href: "/#how-value", label: "How value is calculated" },
  { href: "/#about-4g-5g", label: "About 4G and 5G" },
  { href: "/providers#update-labels", label: "What the update labels mean" },
] as const;

/** Logo left; page links and the Help menu right; one menu button on phones. */
export function SiteHeader() {
  return (
    // Pinned and solid (no blur on phones). Hidden on bare pages (not found, error).
    <header className="sticky top-0 z-30 border-b border-line-soft bg-canvas [body:has(main[data-bare])_&]:hidden">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 pr-2 pl-4 sm:h-15 sm:px-6">
        <Link
          href="/"
          aria-label="TeleRanker home"
          className="rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Logo size={20} />
        </Link>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <nav aria-label="Main">
            <ul className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} label={item.label} />
                </li>
              ))}
            </ul>
          </nav>
          <span aria-hidden="true" className="h-5 w-px bg-line" />
          <HelpMenu links={HELP_LINKS} />
        </div>

        <button
          type="button"
          popoverTarget={MENU_ID}
          aria-label="Open menu"
          className="ml-auto flex size-11 items-center justify-center rounded-lg text-fg hover:bg-raised focus-visible:outline-2 sm:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 8h16M4 16h16" />
          </svg>
        </button>
        <nav
          id={MENU_ID}
          popover="auto"
          aria-label="Main"
          className="m-0 mt-14 mr-2 ml-auto w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-line bg-raised p-2 text-fg sm:hidden"
        >
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} label={item.label} block />
              </li>
            ))}
            {HELP_LINKS.map((link, index) => (
              <li key={link.href} className={index === 0 ? "mt-1 border-t border-line pt-1" : undefined}>
                {/* Plain <a>, like the Help menu's, so it lands on the section from any page. */}
                <a
                  href={link.href}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm text-fg-3 hover:bg-selected hover:text-fg"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
