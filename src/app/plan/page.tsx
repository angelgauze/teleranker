import type { Metadata } from "next";
import { connection } from "next/server";
import { CompareTray } from "../_components/compare-picker";
import { HashScroll } from "../_components/hash-scroll";
import { PlanControls } from "../_components/plan-controls";
import { DEFAULT_DAYS, planHref, type PlanValues } from "../_components/plan-href";
import { PlanStep } from "../_components/plan-step";
import {
  CannotPlan,
  PairAnswer,
  PlanList,
  PlanPair,
  pluralDays,
  RankingAnswer,
} from "../_components/plan-views";
import { displayNames } from "@/lib/compare/differences";
import { isFourGOnlyPhone, parseNeeds, planForNeeds, rawNeeds } from "@/lib/compare/needs";
import { isSamePromo } from "@/lib/db/promo-duplicates";
import { parseProviderIds } from "@/lib/db/promo-filter";
import { loadListing, loadPromosByIds } from "@/lib/db/promos";
import { rankPlans } from "@/lib/plan/rank";

// The plan depends on live database state, so it cannot be prerendered.
export const instant = false;

// The tab uses the nav name; the page heading reads "Plan for your needs".
export const metadata: Metadata = { title: "Plan" };

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

// A short first answer; "Show more" adds the same again.
const PAGE_SIZE = 5;
const MAX_SHOWN = 200;

/** The pair from Compare, without blanks or repeats; anything but two is "no pair". */
function pairIds(params: Params): string[] {
  const raw = Array.isArray(params.id) ? params.id : params.id ? [params.id] : [];
  const ids = [...new Set(raw.filter(Boolean))];
  return ids.length === 2 ? ids : [];
}

function shownCount(params: Params): number {
  const raw = Number(Array.isArray(params.show) ? params.show[0] : params.show);
  return Number.isInteger(raw) && raw > PAGE_SIZE ? Math.min(raw, MAX_SHOWN) : PAGE_SIZE;
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[15px] text-fg-3">{children}</p>
  );
}

/** Plan: the cheapest way to have data for the days you need; from Compare, step 1 offers "These two". */
export default async function PlanPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const raw = rawNeeds(params);
  const fourGOnly = isFourGOnlyPhone(params);
  const providerIds = parseProviderIds(params.provider);
  const days = raw.days || DEFAULT_DAYS;
  const initial: PlanValues = { days, daily: raw.daily, budget: raw.budget, fourGOnly, providers: providerIds };
  const result = parseNeeds({ ...params, days });
  const allPromosChosen = (Array.isArray(params.promos) ? params.promos[0] : params.promos) === "all";

  // The pair, when Compare sent one and both promos still exist.
  const requested = pairIds(params);
  const pairLoad = requested.length === 2 ? await loadPromosByIds(requested) : null;
  const pairPromos =
    pairLoad && pairLoad.promos.length === 2 && !isSamePromo(pairLoad.promos[0].promo, pairLoad.promos[1].promo)
      ? pairLoad.promos
      : null;
  const labels = pairPromos ? displayNames(pairPromos[0], pairPromos[1]) : null;
  const entries =
    pairPromos && labels
      ? ([
          { ...pairPromos[0], label: labels[0] },
          { ...pairPromos[1], label: labels[1] },
        ] as const)
      : null;
  const ids = entries ? requested : [];
  const pairActive = entries !== null && !allPromosChosen;

  const listing = await loadListing({ sort: "price" });
  const databaseUnavailable = (pairLoad?.databaseUnavailable ?? false) || listing.databaseUnavailable;
  const shown = shownCount(params);
  const needsLabel = result.state === "ok" ? pluralDays(result.needs.days) : "your days";

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-16 tabular-nums sm:px-6 md:pt-16">
      <header className="grid gap-x-12 gap-y-2.5 md:grid-cols-2 md:items-start md:gap-y-4">
        <h1 className="text-[28px] leading-[1.02] font-[560] tracking-[-0.035em] text-fg md:text-[56px]">
          Plan for
          <br />
          your needs
        </h1>
        <p className="max-w-[34rem] text-[15px] leading-relaxed text-fg-2 md:pt-2 md:text-xl md:leading-snug">
          The cheapest way to have data for the days you need, buying again as each promo runs out.{" "}
          <span className="text-fg-4">Signal and speed are not included.</span>
        </p>
      </header>

      {requested.length === 2 && !entries && !databaseUnavailable ? (
        <p role="status" className="mt-6 text-[13px] text-fg-3">
          The promos picked in Compare could not be found, so every promo is shown.
        </p>
      ) : null}

      <div className="mt-8 border-t border-line-soft md:mt-14">
        <PlanControls
          initial={initial}
          pair={entries ? { ids, names: [entries[0].label, entries[1].label], active: pairActive } : null}
          providers={listing.providers}
        />

        <PlanStep
          titleId="plan-results"
          title={pairActive ? "For these two" : `Cheapest for ${needsLabel}`}
          helper={
            pairActive
              ? "What each costs for your days, side by side."
              : "Every current promo, costed for your days. Pick two to compare them."
          }
        >
          {databaseUnavailable ? (
            <Hint>The promo database cannot be reached right now. Try again in a moment.</Hint>
          ) : result.state === "invalid" ? (
            <p role="alert" className="text-sm font-medium text-fg">
              {result.message}
            </p>
          ) : result.state !== "ok" ? (
            <Hint>Pick how many days you need data for to see what it costs.</Hint>
          ) : pairActive && entries ? (
            (() => {
              const plans = [planForNeeds(entries[0], result.needs), planForNeeds(entries[1], result.needs)] as const;
              return (
                <div className="flex flex-col gap-4">
                  <PairAnswer entries={[entries[0], entries[1]]} plans={[plans[0], plans[1]]} needs={result.needs} />
                  <PlanPair entries={[entries[0], entries[1]]} plans={[plans[0], plans[1]]} needs={result.needs} />
                </div>
              );
            })()
          ) : (
            (() => {
              const current = listing.promos.filter(
                ({ promo }) =>
                  promo.status === "ACTIVE" && (providerIds.length === 0 || providerIds.includes(promo.providerId)),
              );
              const ranking = rankPlans(current, result.needs, { fourGOnly });
              if (ranking.ranked.length === 0) {
                return (
                  <div className="flex flex-col gap-4">
                    <Hint>No promo can be costed for {pluralDays(result.needs.days)} with what you entered.</Hint>
                    <CannotPlan ranking={ranking} />
                  </div>
                );
              }
              const href = planHref(initial, ids, ids.length > 0);
              const moreHref =
                shown < ranking.ranked.length ? `${href}${href.includes("?") ? "&" : "?"}show=${shown + PAGE_SIZE}` : null;
              return (
                <div className="flex flex-col gap-4">
                  <RankingAnswer ranking={ranking} needs={result.needs} />
                  {result.needs.dailyGb === undefined ? (
                    <p className="text-[13px] text-fg-3">
                      Without your daily data use (step 3), the cheapest promos may include little data.
                    </p>
                  ) : null}
                  <PlanList
                    ranking={ranking}
                    shown={shown}
                    moreHref={moreHref}
                    lessHref={shown > PAGE_SIZE ? href : null}
                    fourGOnly={fourGOnly}
                    step={PAGE_SIZE}
                  />
                  <CannotPlan ranking={ranking} />
                </div>
              );
            })()
          )}
        </PlanStep>
      </div>

      <p className="mt-6 text-[11px] leading-normal text-fg-4 md:text-xs">
        Assumes you buy again when a promo expires or its data runs out. Only all-access data counts, and unused data
        is assumed not to carry over. Only current promos are planned. Unknown values are never guessed.
      </p>
      <CompareTray />
      <HashScroll />
    </main>
  );
}
