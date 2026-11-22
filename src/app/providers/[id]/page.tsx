import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { loadProviderOverview } from "@/lib/db/promos";
import { DatabaseNotice } from "../../_components/database-notice";
import { ProviderFacts } from "../../_components/provider-facts";
import { StatusLabel } from "../../_components/status-label";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

/** One database read per request, shared by the tab title and the page. */
const getProviderOverview = cache((id: string) => loadProviderOverview(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { provider } = await getProviderOverview(id);
  return { title: provider ? provider.name : "Page not found" };
}

function OfficialLink({ href, label }: { href?: string; label: string }) {
  if (!href) return <span className="text-zinc-600 dark:text-zinc-400">No official link stored</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default async function ProviderPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const { provider, databaseUnavailable } = await getProviderOverview(id);

  if (databaseUnavailable) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Provider</h1>
        <DatabaseNotice />
      </main>
    );
  }
  if (!provider) notFound();

  const { name, status, summary } = provider;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm">
        <Link href="/providers" className="underline underline-offset-2">
          <span aria-hidden="true">←</span> All providers
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-2">
        <StatusLabel status={status} />
      </div>

      <section aria-labelledby="source-heading" className="mt-8">
        <h2 id="source-heading" className="text-lg font-semibold">
          Where the data comes from
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            Official website: <OfficialLink href={provider.websiteUrl} label={`${name} website`} />
          </li>
          <li>
            Promo page: <OfficialLink href={provider.promoPageUrl} label={`${name} promo page`} />
          </li>
        </ul>
      </section>

      <section aria-labelledby="summary-heading" className="mt-8">
        <h2 id="summary-heading" className="text-lg font-semibold">
          Promos at a glance
        </h2>
        {summary.current > 0 ? (
          <>
            <div className="mt-3">
              <ProviderFacts summary={summary} />
            </div>
            <Link
              href={`/?provider=${encodeURIComponent(provider.id)}`}
              className="mt-6 inline-block rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Browse all {summary.current} {name} promos
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {name} has no current promos right now.
          </p>
        )}
      </section>
    </main>
  );
}
