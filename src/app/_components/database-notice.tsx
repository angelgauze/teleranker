/** Shown instead of data when the promo database is not configured or unreachable. */
export function DatabaseNotice() {
  return (
    <section
      role="status"
      className="mt-8 rounded-xl border border-line-strong bg-surface p-5 text-sm leading-relaxed text-fg-2"
    >
      <h2 className="flex items-center gap-2 font-[590] text-fg">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        Database not available
      </h2>
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
