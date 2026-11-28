import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { loadProviderOverviews, type ProviderOverview } from "@/lib/db/promos";
import { priceScale, rangeBar, scaleTicks, type PriceScale } from "@/lib/providers/price-scale";
import { formatPriceRange } from "@/lib/providers/summary";
import { formatPeso } from "@/lib/ui/format";
import { DatabaseNotice } from "../_components/database-notice";
import { HashScroll } from "../_components/hash-scroll";
import { StatusMark } from "../_components/status-mark";

// Provider status and counts depend on live database state, so the page cannot be prerendered.
export const instant = false;

export const metadata: Metadata = { title: "Providers" };

/** "None", "4 promos", "2 promos · 7 not verified": how many need a 5G phone, honest about unknowns. */
function fiveGText(provider: ProviderOverview): string {
  const { FIVE_G: fiveG, UNKNOWN: unknown } = provider.summary.compatibility;
  const needs = fiveG === 0 ? "None" : `${fiveG} promo${fiveG === 1 ? "" : "s"}`;
  return unknown > 0 ? `${needs} · ${unknown} not verified` : needs;
}

/** One provider's price range on the page's shared scale, with its own figures above the bar. */
function PriceRange({ provider, scale }: { provider: ProviderOverview; scale: PriceScale }) {
  const { minPriceCentavos: min, maxPriceCentavos: max } = provider.summary;
  const range = formatPriceRange(provider.summary);
  const bar = min !== null && max !== null ? rangeBar(min, max, scale) : null;
  const ticks = scaleTicks(scale);

  return (
    <div>
      <p className="flex items-baseline justify-between gap-4 text-xs text-fg-4">
        <span>Price range</span>
        <span className="text-sm text-fg">{range}</span>
      </p>
      <div
        role="img"
        aria-label={`Prices ${range}, on a scale from ${formatPeso(Math.round(scale.lo * 100))} to ${formatPeso(Math.round(scale.hi * 100))}`}
        className="relative mt-2.5 h-2 rounded-full bg-line-soft"
      >
        {ticks.map((tick) => (
          <span key={tick.pesos} aria-hidden="true" className="absolute inset-y-0 w-px bg-line" style={{ left: `${tick.percent}%` }} />
        ))}
        {bar ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 rounded-full bg-fg-2"
            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
          />
        ) : null}
      </div>
      <div aria-hidden="true" className="relative mt-1.5 h-3.5 text-[10px] text-fg-4">
        {ticks.map((tick) => (
          <span
            key={tick.pesos}
            className={`absolute ${tick.percent < 1 ? "" : "-translate-x-1/2"}`}
            style={{ left: `${tick.percent}%` }}
          >
            {formatPeso(tick.pesos * 100)}
          </span>
        ))}
      </div>
    </div>
  );
}

const SECTION = "grid gap-x-12 gap-y-5 border-b border-line-soft py-8 md:grid-cols-2 md:py-10";

function ProviderSection({ provider, scale }: { provider: ProviderOverview; scale: PriceScale | null }) {
  const { summary, status } = provider;
  return (
    <section id={provider.id} aria-labelledby={`provider-${provider.id}`} className={`${SECTION} scroll-mt-20 sm:scroll-mt-24`}>
      <div>
        <h2 id={`provider-${provider.id}`} className="text-xl leading-tight font-[590] tracking-[-0.02em] text-fg md:text-2xl">
          {provider.name}
        </h2>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-fg">
          <StatusMark tone={status.tone} />
          {status.label}
          <span aria-hidden="true" className="text-fg-4">
            ·
          </span>
          {provider.promoPageUrl ? (
            <a
              href={provider.promoPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-[13px] font-normal text-fg-3 underline underline-offset-4 hover:text-fg sm:min-h-0"
            >
              {provider.name} promo page
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="text-[13px] font-normal text-fg-4">No promo page link on file</span>
          )}
        </p>
        <ul className="mt-3 flex max-w-[44ch] flex-col gap-1 text-[13px] leading-relaxed text-fg-4">
          {status.detail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        {summary.current > 0 && scale ? (
          <PriceRange provider={provider} scale={scale} />
        ) : (
          <p className="text-sm text-fg-3">No current promos right now.</p>
        )}
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-fg-4">Current promos</dt>
            <dd className="mt-1 text-[22px] leading-tight font-[590] tracking-[-0.02em] text-fg">
              {summary.current}
              {summary.outdated > 0 ? (
                <span className="ml-1.5 text-xs font-normal tracking-normal text-fg-3">{summary.outdated} outdated</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-4">Needs a 5G phone</dt>
            <dd className="mt-1.5 text-sm text-fg">{fiveGText(provider)}</dd>
          </div>
        </dl>
          {summary.current > 0 ? (
            <Link
              href={`/?provider=${encodeURIComponent(provider.id)}`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3.5 text-[13px] font-medium text-fg hover:border-fg-4 focus-visible:outline-2 sm:h-9 sm:rounded-[7px] sm:px-3"
            >
              See {summary.current} promos<span className="sr-only"> from {provider.name}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const LABELS: Array<{ tone: ProviderOverview["status"]["tone"]; label: string; text: string }> = [
  {
    tone: "ok",
    label: "Updated automatically",
    text: "We read the provider’s promo page about once a week and publish the details after our checks.",
  },
  {
    tone: "manual",
    label: "Updated manually",
    text: "A team member checks the provider’s promo page and enters the details by hand. Promos not re-checked within 14 days are marked Outdated.",
  },
  {
    tone: "paused",
    label: "Automatic updates paused",
    text: "The automatic check could not finish, so the last good details stay up and are updated by hand meanwhile.",
  },
];

/** Providers: one section per provider, with price ranges on one shared scale. */
export default async function ProvidersPage() {
  await connection();
  const { providers, databaseUnavailable } = await loadProviderOverviews();
  const scale = priceScale(providers.map(({ summary }) => summary));

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 tabular-nums sm:px-6 md:pt-16 short:pt-7">
      <header className="grid gap-x-12 gap-y-2.5 md:grid-cols-2 md:items-start md:gap-y-4">
        <h1 className="text-[28px] leading-[1.02] font-[560] tracking-[-0.035em] text-fg md:text-[56px] short:text-[28px]">Providers</h1>
        <p className="max-w-[34rem] text-[15px] leading-relaxed text-fg-2 md:pt-2 md:text-xl md:leading-snug short:pt-0 short:text-[15px] short:leading-relaxed">
          Every provider we list, how we keep its promos up to date, and what its promos cost.{" "}
          <span className="text-fg-4">Each one links to its own promo page.</span>
        </p>
      </header>

      {databaseUnavailable ? (
        <div className="mt-8">
          <DatabaseNotice />
        </div>
      ) : providers.length === 0 ? (
        <p className="mt-8 text-sm text-fg-3">No providers are listed yet.</p>
      ) : (
        <div className="mt-8 border-t border-line-soft md:mt-14 short:mt-6">
          {providers.map((provider) => (
            <ProviderSection key={provider.id} provider={provider} scale={scale} />
          ))}

          <section aria-labelledby="update-labels" className="pt-10 md:pt-16">
            <h2 id="update-labels" className="scroll-mt-20 text-xl leading-tight font-[590] tracking-[-0.02em] text-fg sm:scroll-mt-24 md:text-2xl">
              What the update labels mean
            </h2>
            <dl className="mt-4 border-t border-line-soft">
              {LABELS.map(({ tone, label, text }) => (
                <div key={label} className="grid gap-x-4 gap-y-1.5 border-b border-line-soft py-3.5 sm:grid-cols-[15rem_minmax(0,1fr)]">
                  <dt className="flex items-center gap-2 text-sm font-medium text-fg">
                    <StatusMark tone={tone} />
                    {label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-fg-3">{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
      <HashScroll />
    </main>
  );
}
