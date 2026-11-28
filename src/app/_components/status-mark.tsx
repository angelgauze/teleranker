import type { CollectionStatus } from "@/lib/ui/collection-status";

/**
 * The mark beside a provider's written update label (never colour alone):
 * a dot for automatic, a hollow dot for manual, a pause icon for paused.
 */
export function StatusMark({ tone }: { tone: CollectionStatus["tone"] }) {
  if (tone === "ok") return <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-fg-2" />;
  if (tone === "paused") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3 shrink-0 fill-fg-2">
        <rect x="5" y="4" width="5" height="16" rx="1" />
        <rect x="14" y="4" width="5" height="16" rx="1" />
      </svg>
    );
  }
  return <span aria-hidden="true" className="size-2 shrink-0 rounded-full border-[1.5px] border-fg-3" />;
}
