"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

/**
 * Fallback for unexpected errors while rendering a page. Expected problems
 * (database not configured or unreachable) are handled inside the pages; this
 * covers everything else. No error details are shown to users.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <section
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
      >
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm">
          The page could not be displayed. Published promo data is not affected. Try again, or go
          back to the listing.
        </p>
      </section>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Try again
        </button>
        <Link href="/" className="text-sm underline underline-offset-2">
          Back to the listing
        </Link>
      </div>
    </main>
  );
}
