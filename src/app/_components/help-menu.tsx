"use client";

import { useRef } from "react";

const HELP_ID = "help-menu";

/**
 * The header's Help menu, a native popover; choosing a link closes it. Plain <a>
 * links, so the browser's own jump lands on the section from any page.
 */
export function HelpMenu({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  const menu = useRef<HTMLDivElement>(null);

  return (
    <>
      <button
        type="button"
        popoverTarget={HELP_ID}
        className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-fg-3 hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Help
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        ref={menu}
        id={HELP_ID}
        popover="auto"
        // Fixed under the header, lined up with the page's right edge (1200px column, 24px gutter).
        className="inset-auto top-[52px] right-[max(1.5rem,calc((100vw-1200px)/2+1.5rem))] m-0 w-64 rounded-xl border border-line bg-raised p-1.5 text-fg"
      >
        <ul aria-label="Help">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => menu.current?.hidePopover()}
                className="flex min-h-10 items-center rounded-lg px-3 text-sm text-fg-2 hover:bg-selected hover:text-fg focus-visible:outline-2"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
