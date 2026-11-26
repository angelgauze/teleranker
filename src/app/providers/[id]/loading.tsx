/** Shown while a provider's data loads. Placeholder blocks only; no data is implied. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading provider…
      </p>
      <div className="mt-6 animate-pulse space-y-4 motion-reduce:animate-none" aria-hidden="true">
        <div className="h-9 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-32 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </main>
  );
}
