/** Shown while provider data loads. Placeholder blocks only; no data is implied. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading providers…
      </p>
      <div
        className="mt-6 grid animate-pulse gap-4 motion-reduce:animate-none md:grid-cols-2 xl:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-48 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </main>
  );
}
