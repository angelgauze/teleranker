"use client";

import { RetryButton } from "../../_components/retry-button";

/** Something failed while loading the comparison: say so inside the pop-up; the listing is unaffected. */
export default function CompareModalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pb-8">
      <h2 className="text-2xl leading-tight font-[590] tracking-[-0.02em] text-fg">Comparison unavailable</h2>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-fg-3">
        The comparison could not be loaded. The listing is not affected.
      </p>
      <div className="mt-5">
        <RetryButton onRetry={reset} />
      </div>
    </div>
  );
}
