import type { CollectionStatus } from "@/lib/ui/collection-status";

const TONE_CLASS: Record<CollectionStatus["tone"], string> = {
  ok: "text-emerald-800 dark:text-emerald-300",
  paused: "text-amber-800 dark:text-amber-300",
  manual: "text-zinc-800 dark:text-zinc-200",
  none: "text-zinc-600 dark:text-zinc-400",
};

/** A provider's public collection status: a text label (never colour alone) and its detail. */
export function StatusLabel({ status }: { status: CollectionStatus }) {
  return (
    <>
      <p className={`text-sm font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</p>
      {status.detail.map((line) => (
        <p key={line} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {line}
        </p>
      ))}
    </>
  );
}
