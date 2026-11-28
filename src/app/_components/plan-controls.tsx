"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { planHref, type PlanValues } from "./plan-href";
import { PlanStep } from "./plan-step";

/** Quick picks: most people plan for a week, two weeks or a month. */
const DAY_CHIPS = ["7", "15", "30"] as const;
const TEXT_DELAY_MS = 450;

const BOX =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-[15px] text-fg tabular-nums [appearance:textfield] hover:border-line-strong focus-visible:border-fg-3 focus-visible:outline-none sm:h-10 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** A segment of a two- or four-part switch. */
const segment = (on: boolean) =>
  `flex h-10 min-w-0 cursor-pointer items-center justify-center rounded-md px-3 text-[13px] whitespace-nowrap sm:h-8 ${
    on ? "bg-selected font-[590] text-fg" : "font-medium text-fg-3 hover:text-fg"
  } focus-visible:outline-2`;

/** A toggle chip (providers), highlighted when on; no check mark. */
const toggle = (on: boolean) =>
  `inline-flex h-10 items-center rounded-lg border px-3.5 text-[13px] sm:h-9 ${
    on ? "border-fg-3 bg-selected font-[590] text-fg" : "border-line font-medium text-fg-3 hover:border-line-strong hover:text-fg"
  } focus-visible:outline-2`;

const isChip = (days: string) => DAY_CHIPS.includes(days as (typeof DAY_CHIPS)[number]);

/** Plan's three steps. Each starts from a default; changes replace the address live. */
export function PlanControls({
  initial,
  pair,
  providers,
}: {
  initial: PlanValues;
  /** The two promos sent from Compare, when the address named a valid pair; `active` unless "All promos" was chosen. */
  pair: { ids: string[]; names: [string, string]; active: boolean } | null;
  providers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  // Planning for the pair, or for every promo; switching back keeps the pair.
  const [usePair, setUsePair] = useState(pair?.active ?? false);
  const [pending, startTransition] = useTransition();
  const [otherDays, setOtherDays] = useState(() => initial.days !== "" && !isChip(initial.days));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daysBox = useRef<HTMLInputElement>(null);
  const editing = useRef<keyof PlanValues | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The address can change from outside (the nav's Plan link, Back). Follow
  // it, except for the box being typed in, so the boxes never show numbers
  // the results are not using.
  const { days, daily, budget, fourGOnly } = initial;
  const providerKey = initial.providers.join(",");
  const pairActive = pair?.active ?? false;
  useEffect(() => {
    setValues((current) => {
      const next = { days, daily, budget, fourGOnly, providers: providerKey ? providerKey.split(",") : [] };
      if (editing.current) return { ...next, [editing.current]: current[editing.current] };
      return next;
    });
    if (editing.current !== "days") setOtherDays(days !== "" && !isChip(days));
    setUsePair(pairActive);
  }, [days, daily, budget, fourGOnly, providerKey, pairActive]);

  const go = (next: PlanValues, withPair = usePair) => {
    startTransition(() => router.replace(planHref(next, pair ? pair.ids : [], !withPair), { scroll: false }));
  };
  const change = (patch: Partial<PlanValues>, delay = 0) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (timer.current) clearTimeout(timer.current);
    if (delay > 0) timer.current = setTimeout(() => go(next), delay);
    else go(next);
  };

  // The box names match the value keys (days, daily, budget).
  const onTextFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    editing.current = event.currentTarget.name as keyof PlanValues;
  };
  const onTextBlur = () => {
    editing.current = null;
  };

  const toggleProvider = (id: string) => {
    const on = values.providers.includes(id);
    change({ providers: on ? values.providers.filter((p) => p !== id) : [...values.providers, id] });
  };

  return (
    <form
      method="get"
      action="/plan"
      aria-label="Your needs"
      aria-busy={pending || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(values);
      }}
    >
      {pair ? pair.ids.map((id) => <input key={id} type="hidden" name="id" value={id} />) : null}
      {pair && !usePair ? <input type="hidden" name="promos" value="all" /> : null}
      {usePair ? null : values.providers.map((id) => <input key={id} type="hidden" name="provider" value={id} />)}

      <PlanStep
        step="Step 1"
        titleId="plan-step-promos"
        title={pair ? "Promos" : "Providers"}
        helper={
          pair
            ? "Plan for the two promos you compared, or for every promo."
            : "Leave every provider on to plan across all of them."
        }
      >
        <div className="flex flex-col gap-3">
          {pair ? (
            <div role="group" aria-label="Promos to plan for" className="grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-surface p-[3px] sm:max-w-md">
              <button
                type="button"
                aria-pressed={usePair}
                onClick={() => {
                  setUsePair(true);
                  go(values, true);
                }}
                className={segment(usePair)}
              >
                These two
              </button>
              <button
                type="button"
                aria-pressed={!usePair}
                onClick={() => {
                  setUsePair(false);
                  go(values, false);
                }}
                className={segment(!usePair)}
              >
                All promos
              </button>
            </div>
          ) : null}
          {pair && usePair ? (
            <p className="text-[13px] leading-relaxed text-fg-3">
              <span className="font-[590] text-fg">{pair.names[0]}</span> and{" "}
              <span className="font-[590] text-fg">{pair.names[1]}</span>
            </p>
          ) : (
            <div role="group" aria-label="Providers" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={values.providers.length === 0}
                onClick={() => change({ providers: [] })}
                className={toggle(values.providers.length === 0)}
              >
                All providers
              </button>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  aria-pressed={values.providers.includes(provider.id)}
                  onClick={() => toggleProvider(provider.id)}
                  className={toggle(values.providers.includes(provider.id))}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </PlanStep>

      <PlanStep step="Step 2" titleId="plan-step-days" title="Days you need data for" helper="Starts at 30 days; pick yours.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div role="group" aria-label="Days" className="grid grid-cols-4 gap-0.5 rounded-lg border border-line bg-surface p-[3px] sm:w-max">
            {DAY_CHIPS.map((chipDays) => {
              const on = !otherDays && values.days === chipDays;
              return (
                <button
                  key={chipDays}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setOtherDays(false);
                    change({ days: chipDays });
                  }}
                  className={segment(on)}
                >
                  {chipDays} days
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={otherDays}
              onClick={() => {
                setOtherDays(true);
                requestAnimationFrame(() => daysBox.current?.focus());
              }}
              className={segment(otherDays)}
            >
              Other
            </button>
          </div>
          {otherDays ? (
            <label className="flex items-center gap-2 text-[13px] text-fg-3">
              <input
                ref={daysBox}
                name="days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                aria-label="Number of days"
                value={values.days}
                onChange={(event) => change({ days: event.currentTarget.value }, TEXT_DELAY_MS)}
                onFocus={onTextFocus}
                onBlur={onTextBlur}
                className={`${BOX} sm:w-24`}
              />
              <span aria-hidden="true">days</span>
            </label>
          ) : (
            <input type="hidden" name="days" value={values.days} />
          )}
        </div>
      </PlanStep>

      <PlanStep
        step="Step 3"
        titleId="plan-step-usage"
        title="Your usage"
        helper="Optional, but the more you fill in, the better the results."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-fg-3">
              <span>Data per day (GB)</span>
              <input
                name="daily"
                type="number"
                inputMode="decimal"
                min={0.1}
                max={50}
                step={0.1}
                value={values.daily}
                onChange={(event) => change({ daily: event.currentTarget.value }, TEXT_DELAY_MS)}
                onFocus={onTextFocus}
                onBlur={onTextBlur}
                className={BOX}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-fg-3">
              <span>Budget (₱)</span>
              <input
                name="budget"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                value={values.budget}
                onChange={(event) => change({ budget: event.currentTarget.value }, TEXT_DELAY_MS)}
                onFocus={onTextFocus}
                onBlur={onTextBlur}
                className={BOX}
              />
            </label>
          </div>
          <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm text-fg hover:text-white sm:min-h-9 sm:text-[13px] sm:text-fg-2">
            <input
              type="checkbox"
              name="phone"
              value="4g"
              checked={values.fourGOnly}
              onChange={(event) => change({ fourGOnly: event.currentTarget.checked })}
              className="size-[18px] accent-fg sm:size-4"
            />
            My phone is 4G only
          </label>
          <noscript>
            <button type="submit" className="h-10 w-fit rounded-lg border border-fg-3 bg-selected px-4 text-sm font-[590] text-fg">
              Show plan
            </button>
          </noscript>
        </div>
      </PlanStep>
    </form>
  );
}
