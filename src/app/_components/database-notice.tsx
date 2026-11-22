/** Shown instead of data when the promo database is not configured or unreachable. */
export function DatabaseNotice() {
  return (
    <section
      role="status"
      className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <h2 className="font-semibold">Database not available</h2>
      <p className="mt-1">The promo database is not configured or cannot be reached.</p>
      <p className="mt-2">To fix it:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          Set <code>DATABASE_URL</code>.
        </li>
        <li>
          Run <code>pnpm db:migrate</code>.
        </li>
        <li>
          Publish data with <code>pnpm scrape --live --publish</code> or{" "}
          <code>pnpm import:promos --publish</code>.
        </li>
      </ol>
    </section>
  );
}
