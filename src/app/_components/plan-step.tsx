/** One Plan section: label, heading and helper left, content right; stacked on phones. */
export function PlanStep({
  step,
  title,
  titleId,
  helper,
  children,
}: {
  /** "Step 1"; omitted for the results. */
  step?: string;
  title: React.ReactNode;
  titleId: string;
  helper?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      // The page header's columns, so content starts where its intro does.
      className="grid gap-x-12 gap-y-5 border-b border-line-soft py-8 md:grid-cols-2 md:py-10"
    >
      <div>
        {step ? <p className="mb-1.5 text-[13px] font-medium text-fg-4">{step}</p> : null}
        <h2 id={titleId} className="text-xl leading-tight font-[590] tracking-[-0.02em] text-fg md:text-2xl">
          {title}
        </h2>
        {helper ? <div className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-fg-3 md:text-sm">{helper}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
