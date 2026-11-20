/**
 * Shown while a page's data loads (for example after changing filters).
 * Placeholder blocks only; no promo data is implied.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading promos…
      </p>
      <div className="mt-6 animate-pulse space-y-3 motion-reduce:animate-none" aria-hidden="true">
        <div className="h-8 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-24 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-14 rounded bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </main>
  );
}
