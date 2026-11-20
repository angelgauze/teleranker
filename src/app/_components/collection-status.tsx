import type { ProviderCollectionStatus } from "@/lib/db/promos";
import { ProviderBadge } from "./provider-badge";

const TONE_CLASS: Record<ProviderCollectionStatus["status"]["tone"], string> = {
  ok: "text-emerald-800 dark:text-emerald-300",
  paused: "text-amber-800 dark:text-amber-300",
  manual: "text-zinc-800 dark:text-zinc-200",
  none: "text-zinc-600 dark:text-zinc-400",
};

/**
 * Public data-freshness summary per provider. Each state has a text label,
 * so it never relies on colour alone.
 */
export function CollectionStatusList({ statuses }: { statuses: ProviderCollectionStatus[] }) {
  if (statuses.length === 0) return null;

  return (
    <section aria-labelledby="data-status-heading" className="mt-6">
      <h2 id="data-status-heading" className="text-sm font-semibold">
        Where the data comes from
      </h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map(({ providerId, providerName, status }) => (
          <li
            key={providerId}
            className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <ProviderBadge name={providerName} />
              <span className={`font-medium ${TONE_CLASS[status.tone]}`}>
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{status.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
