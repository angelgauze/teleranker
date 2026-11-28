"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

/**
 * Fallback for unexpected errors while rendering a page: a bare page (no site
 * header). Expected problems (database not configured or unreachable) are
 * handled inside the pages. No error details are shown to users.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    // An error boundary can't export metadata, so name the tab here.
    document.title = "Something went wrong · TeleRanker";
  }, [error]);

  return (
    <main data-bare className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-[19rem]">
        <h1 className="text-xl leading-tight font-[590] tracking-[-0.02em] text-fg">Something went wrong</h1>
        <p role="alert" className="mt-2 text-[15px] leading-relaxed text-fg-3">
          This page could not be displayed. Published promo details are not affected.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 rounded-lg bg-fg px-5 text-sm font-[590] text-canvas hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg border border-line bg-surface px-5 text-sm font-medium text-fg hover:border-line-strong focus-visible:outline-2"
          >
            Back to promos
          </Link>
        </div>
      </div>
    </main>
  );
}
