"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** "Try again" for a comparison that could not load: asks the server once more, in place. */
export function RetryButton({ onRetry }: { onRetry?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          onRetry?.();
          router.refresh();
        })
      }
      className="h-11 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg-2 hover:border-line-strong hover:text-fg focus-visible:outline-2 disabled:text-fg-4"
    >
      {pending ? "Trying again…" : "Try again"}
    </button>
  );
}
