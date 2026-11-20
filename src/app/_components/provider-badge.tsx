/**
 * Providers are shown as plain text badges, never logos or provider marketing
 * images (team decision, 2026-11-20).
 */
export function ProviderBadge({ name }: { name: string }) {
  return (
    <span className="inline-block rounded border border-zinc-300 px-1.5 py-0.5 text-xs font-medium tracking-wide text-zinc-700 uppercase dark:border-zinc-700 dark:text-zinc-300">
      {name}
    </span>
  );
}
