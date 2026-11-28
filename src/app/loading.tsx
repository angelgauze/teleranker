/**
 * Shown while a page's data loads (for example on a first visit).
 * Placeholder blocks only; no promo data is implied.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-16 sm:px-6 sm:pt-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p role="status" className="text-sm text-fg-4">
        Loading promos…
      </p>
      <div className="mt-6 animate-pulse space-y-3 motion-reduce:animate-none" aria-hidden="true">
        <div className="h-8 w-1/2 rounded-lg bg-raised" />
        <div className="h-11 rounded-lg bg-surface" />
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-16 border-t border-line-soft first:border-t-0" />
          ))}
        </div>
      </div>
    </main>
  );
}
