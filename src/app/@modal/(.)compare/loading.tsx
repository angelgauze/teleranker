/** Placeholder rows inside the pop-up while the two promos load. */
export default function CompareModalLoading() {
  return (
    <div role="status" aria-label="Loading the comparison" className="animate-pulse pb-8">
      <div className="h-36 rounded-xl border border-line bg-surface" />
      <div className="mt-6 grid grid-cols-2 gap-4 border-b border-line-strong pb-4 md:grid-cols-[10rem_1fr_1fr]">
        <div className="hidden md:block" />
        <div className="h-10 rounded-md bg-selected" />
        <div className="h-10 rounded-md bg-selected" />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid grid-cols-2 gap-4 border-b border-line-soft py-4 md:grid-cols-[10rem_1fr_1fr]">
          <div className="col-span-2 h-3 w-24 rounded bg-selected md:col-span-1" />
          <div className="h-3 rounded bg-selected" />
          <div className="h-3 rounded bg-selected" />
        </div>
      ))}
    </div>
  );
}
