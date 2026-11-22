import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { loadProviderOverviews } from "@/lib/db/promos";
import { DatabaseNotice } from "../_components/database-notice";
import { ProviderBadge } from "../_components/provider-badge";
import { ProviderFacts } from "../_components/provider-facts";
import { StatusLabel } from "../_components/status-label";

export const instant = false;

export const metadata: Metadata = { title: "Providers" };

export default async function ProvidersPage() {
  await connection();
  const { providers, databaseUnavailable } = await loadProviderOverviews();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Providers</h1>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Where each provider&rsquo;s promo details come from, how many promos are listed and what
        they cost.
      </p>

      {databaseUnavailable ? (
        <DatabaseNotice />
      ) : providers.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">No providers are listed yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => (
            <li
              key={provider.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <h2>
                  <ProviderBadge name={provider.name} />
                </h2>
                <div className="mt-2">
                  <StatusLabel status={provider.status} />
                </div>
              </div>
              {provider.summary.current > 0 ? (
                <ProviderFacts summary={provider.summary} />
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">No current promos right now.</p>
              )}
              <Link
                href={`/providers/${provider.id}`}
                className="mt-auto text-sm font-medium underline underline-offset-2"
              >
                View provider<span className="sr-only">: {provider.name}</span>{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
