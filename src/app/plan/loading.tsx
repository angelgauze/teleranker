/** Shown while Plan loads: its title and three steps in placeholder blocks, no data implied. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 sm:px-6 md:pt-16 short:pt-7" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your plan…
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="grid gap-x-12 gap-y-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="h-8 w-40 rounded-lg bg-raised md:h-14 short:h-8 md:w-64" />
            <div className="h-8 w-48 rounded-lg bg-raised md:h-14 short:h-8 md:w-80" />
          </div>
          <div className="space-y-2 md:pt-2">
            <div className="h-4 rounded bg-surface md:h-5" />
            <div className="h-4 w-2/3 rounded bg-surface md:h-5" />
          </div>
        </div>
        <div className="mt-8 border-t border-line-soft md:mt-14 short:mt-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="grid gap-x-12 gap-y-5 border-b border-line-soft py-8 md:grid-cols-2 md:py-10">
              <div className="space-y-2.5">
                <div className="h-3 w-12 rounded bg-surface" />
                <div className="h-6 w-56 rounded bg-raised" />
                <div className="h-3 w-48 rounded bg-surface" />
              </div>
              <div className="h-10 w-full rounded-lg bg-surface sm:w-80" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
