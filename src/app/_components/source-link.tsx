import { sourceLinkFor } from "@/lib/ui/format";

/**
 * Official source for a promo: its own link, else the provider's general
 * promo page (labelled as general), else an explicit "No source link".
 * `compact` drops the explanatory note line (the listing's one-line form; the
 * label already names the general page).
 */
export function SourceLink({
  sourceUrl,
  providerName,
  providerPromoPageUrl,
  compact = false,
}: {
  compact?: boolean;
  sourceUrl: string | undefined;
  providerName: string;
  providerPromoPageUrl: string | undefined;
}) {
  const link = sourceLinkFor(sourceUrl, providerName, providerPromoPageUrl);

  if (!link) {
    return <span className="text-zinc-600 dark:text-zinc-400">No source link</span>;
  }

  return (
    <>
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {link.label}
      </a>
      {link.note && !compact ? (
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{link.note}</span>
      ) : null}
    </>
  );
}
