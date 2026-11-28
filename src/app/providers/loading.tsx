/** Shown while provider data loads: the page's shape in placeholder blocks, no data implied. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 sm:px-6 md:pt-16 short:pt-7" aria-busy="true">
      <p role="status" className="sr-only">
        Loading providers…
      </p>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="grid gap-x-12 gap-y-3 md:grid-cols-2">
          <div className="h-9 w-48 rounded-lg bg-raised md:h-14 short:h-8 md:w-72" />
          <div className="space-y-2 md:pt-2">
            <div className="h-4 rounded bg-surface md:h-5" />
            <div className="h-4 w-3/4 rounded bg-surface md:h-5" />
          </div>
        </div>
        <div className="mt-8 border-t border-line-soft md:mt-14 short:mt-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="grid gap-x-12 gap-y-5 border-b border-line-soft py-8 md:grid-cols-2 md:py-10">
              <div className="space-y-3">
                <div className="h-6 w-24 rounded bg-raised" />
                <div className="h-4 w-52 rounded bg-surface" />
                <div className="h-3 w-64 rounded bg-surface" />
              </div>
              <div className="space-y-4">
                <div className="h-2 rounded-full bg-surface" />
                <div className="flex items-end justify-between">
                  <div className="h-8 w-28 rounded bg-surface" />
                  <div className="h-9 w-32 rounded-lg bg-surface" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
