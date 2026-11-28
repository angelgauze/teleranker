/**
 * Providers are shown as plain text badges, never logos or provider marketing
 * images (team decision, 2026-11-20).
 */
export function ProviderBadge({ name, link = false }: { name: string; link?: boolean }) {
  // As a link the name is always underlined: hover styles never show on phones.
  const linkClass = link ? " underline underline-offset-2" : "";
  return (
    <span
      className={`inline-block rounded-md border border-line-strong px-1.5 text-[11px] leading-[18px] font-medium tracking-[0.04em] text-fg-3 uppercase${linkClass}`}
    >
      {name}
    </span>
  );
}
