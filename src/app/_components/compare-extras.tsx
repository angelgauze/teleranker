import Link from "next/link";
import { describeDifferences, type ComparedPromo } from "@/lib/compare/differences";
import {
  fourGPhoneSupport,
  isFourGOnlyPhone,
  NEEDS_LIMITS,
  planForNeeds,
  rawNeeds,
  type Needs,
  type NeedsResult,
} from "@/lib/compare/needs";
import type { PublishedPromo } from "@/lib/db/promos";
import { formatGb, formatPeso } from "@/lib/ui/format";
import { AutoSubmitCheckbox } from "./auto-submit-checkbox";

/** Compare page extras: the differences summary, the 4G phone switch and the needs planner. */

export type CompareParams = Record<string, string | string[] | undefined>;

export type CompareRow = { label: string; value: (entry: PublishedPromo) => string };

/** Shown first in the comparison when the visitor says their phone is 4G only. */
export const PHONE_ROW: CompareRow = {
  label: "On a 4G-only phone",
  value: ({ promo }) => fourGPhoneSupport(promo.compatibility),
};

const KEPT_KEYS = ["phone", "days", "daily", "budget"] as const;

/** Hidden fields that keep the rest of the address when one form is sent. */
function KeepParams({ ids, params, skip }: { ids: string[]; params: CompareParams; skip: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      {KEPT_KEYS.filter((key) => !skip.includes(key)).map((key) => {
        const raw = params[key];
        const value = Array.isArray(raw) ? raw[0] : raw;
        return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
      })}
    </>
  );
}

export function Differences({ a, b }: { a: ComparedPromo; b: ComparedPromo }) {
  return (
    <section
      aria-labelledby="differences-heading"
      className="mt-6 rounded border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 id="differences-heading" className="text-base font-semibold">
        How they differ
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {describeDifferences(a, b).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        Based on price, all-access data and validity only. Signal and speed are not included.
      </p>
    </section>
  );
}

export function PhoneSwitch({ ids, params }: { ids: string[]; params: CompareParams }) {
  return (
    <form method="get" action="/compare" className="mt-6 flex flex-wrap items-center gap-3">
      <KeepParams ids={ids} params={params} skip={["phone"]} />
      <AutoSubmitCheckbox
        name="phone"
        value="4g"
        defaultChecked={isFourGOnlyPhone(params)}
        label="My phone is 4G only"
      />
      <noscript>
        <button type="submit" className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
          Apply
        </button>
      </noscript>
    </form>
  );
}

const pluralDays = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

function PlanResult({ entry, needs }: { entry: ComparedPromo; needs: Needs }) {
  const plan = planForNeeds(entry, needs);
  return (
    <div className="rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
      <h3 className="font-semibold break-words">{entry.label}</h3>
      {plan.state === "cannot" ? (
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">Can&rsquo;t calculate: {plan.reason}.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          <li>
            Buy it {plan.buys === 1 ? "once" : `${plan.buys} times`}: {formatPeso(plan.totalCentavos)} in total
          </li>
          <li>
            Data:{" "}
            {plan.unlimitedData ? "Unlimited" : plan.totalGb === null ? "Unknown" : formatGb(plan.totalGb)}
            {needs.dailyGb !== undefined ? " (covers your daily use)" : ""}
          </li>
          <li>Covers your {pluralDays(needs.days)}</li>
          {plan.fitsBudget === null || plan.budgetGapCentavos === null ? null : plan.fitsBudget ? (
            <li>Fits your budget ({formatPeso(plan.budgetGapCentavos)} left)</li>
          ) : (
            <li>Over your budget by {formatPeso(-plan.budgetGapCentavos)}</li>
          )}
        </ul>
      )}
    </div>
  );
}

const INPUT =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900";

export function PlanForNeeds({
  ids,
  params,
  result,
  entries,
}: {
  ids: string[];
  params: CompareParams;
  result: NeedsResult;
  entries: ComparedPromo[];
}) {
  const raw = rawNeeds(params);
  const { days, dailyGb, budgetPhp } = NEEDS_LIMITS;
  const clearHref = `/compare?${new URLSearchParams([
    ...ids.map((id) => ["id", id]),
    ...(isFourGOnlyPhone(params) ? [["phone", "4g"]] : []),
  ]).toString()}`;

  return (
    <section aria-labelledby="plan-heading" className="mt-10">
      <h2 id="plan-heading" className="text-lg font-semibold">
        Plan for my needs
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        See how often you&rsquo;d buy each promo and what it costs in total.
      </p>
      <form method="get" action="/compare" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <KeepParams ids={ids} params={params} skip={["days", "daily", "budget"]} />
        <label className="text-sm font-medium">
          Days you need
          <input
            name="days"
            type="number"
            inputMode="numeric"
            min={days.min}
            max={days.max}
            step={1}
            required
            defaultValue={raw.days}
            placeholder="30"
            className={INPUT}
          />
        </label>
        <label className="text-sm font-medium">
          Data per day in GB <span className="font-normal text-zinc-600 dark:text-zinc-400">(optional)</span>
          <input
            name="daily"
            type="number"
            inputMode="decimal"
            min={dailyGb.min}
            max={dailyGb.max}
            step={0.1}
            defaultValue={raw.daily}
            placeholder="1.5"
            className={INPUT}
          />
        </label>
        <label className="text-sm font-medium">
          Budget in ₱ <span className="font-normal text-zinc-600 dark:text-zinc-400">(optional)</span>
          <input
            name="budget"
            type="number"
            inputMode="numeric"
            min={budgetPhp.min}
            max={budgetPhp.max}
            step={1}
            defaultValue={raw.budget}
            placeholder="500"
            className={INPUT}
          />
        </label>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Calculate
          </button>
          {result.state !== "none" ? (
            <Link href={clearHref} className="text-sm underline underline-offset-2">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {result.state === "invalid" ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {result.message}
        </p>
      ) : null}

      {result.state === "ok" ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {entries.map((entry) => (
              <PlanResult key={entry.label} entry={entry} needs={result.needs} />
            ))}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
            <li>Assumes you buy again when the promo expires or its data runs out.</li>
            <li>Only all-access data counts, and unused data is assumed not to carry over.</li>
            <li>Unknown values are never guessed, so some promos can&rsquo;t be calculated.</li>
          </ul>
        </>
      ) : null}
    </section>
  );
}
