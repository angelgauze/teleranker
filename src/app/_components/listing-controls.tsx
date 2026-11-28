"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export interface ListingValues {
  max: string;
  min: string;
  q: string;
  validity: string;
  sort: string;
  /** Provider ids; none means every provider. */
  providers: string[];
  compatibility: string;
  inactive: boolean;
}

interface Option {
  value: string;
  label: string;
}

const FILTERS_ID = "listing-filters";
const TEXT_DELAY_MS = 450;

/** The listing's address for a set of values; blank values are left out and paging restarts. */
function listingHref(values: ListingValues): string {
  const params = new URLSearchParams();
  const set = (name: string, value: string) => {
    if (value.trim() !== "") params.set(name, value.trim());
  };
  set("max", values.max);
  set("q", values.q);
  set("validity", values.validity);
  for (const id of values.providers) params.append("provider", id);
  set("min", values.min);
  set("compatibility", values.compatibility);
  if (values.inactive) params.set("inactive", "1");
  if (values.sort !== "value") set("sort", values.sort);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

const FIELD =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-4 hover:border-line-strong focus-visible:border-fg-3 focus-visible:outline-none";

/** The listing's toolbar. Changes update the address live; without JavaScript it is a plain GET form. */
export function ListingControls({
  initial,
  providers,
  validityOptions,
  compatibilityOptions,
  budgetInvalid,
  resultCount,
  children,
}: {
  initial: ListingValues;
  providers: Option[];
  validityOptions: Option[];
  compatibilityOptions: Option[];
  budgetInvalid: { min: boolean; max: boolean };
  /** Promos matching the current address; filters apply live, so the sheet's button just reports it. */
  resultCount: number;
  /** The active-filter pills, shown on a row under the toolbar. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editing = useRef<keyof ListingValues | null>(null);

  // The address can change from outside (a filter pill, Clear all, the back
  // button). Follow it, except for the field being typed in right now.
  useEffect(() => {
    setValues((current) => {
      const next = { ...initial };
      if (editing.current) {
        (next as Record<string, unknown>)[editing.current] = current[editing.current];
      }
      return next;
    });
  }, [initial]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const go = (next: ListingValues) => {
    startTransition(() => router.replace(listingHref(next), { scroll: false }));
  };

  const change = (name: keyof ListingValues, value: string | boolean | string[], delay = 0) => {
    const next = { ...values, [name]: value } as ListingValues;
    setValues(next);
    if (timer.current) clearTimeout(timer.current);
    if (delay > 0) timer.current = setTimeout(() => go(next), delay);
    else go(next);
  };

  const sheetCount =
    (values.providers.length > 0 ? 1 : 0) +
    (values.compatibility ? 1 : 0) +
    (values.min.trim() ? 1 : 0) +
    (values.inactive ? 1 : 0);

  // Text fields wait for a short pause before updating the address.
  const onTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    change(event.currentTarget.name as keyof ListingValues, event.currentTarget.value, TEXT_DELAY_MS);
  };
  const onTextFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    editing.current = event.currentTarget.name as keyof ListingValues;
  };
  const onTextBlur = () => {
    editing.current = null;
  };

  return (
    <form
      method="get"
      action="/"
      role="search"
      aria-label="Find promos"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(values);
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <div
        className={`flex h-12 items-center rounded-lg border bg-raised sm:h-10 sm:min-w-48 sm:flex-[1.3_1_13rem] ${
          budgetInvalid.max ? "border-fg-2" : "border-fg-4"
        } focus-within:border-fg-2 focus-within:ring-2 focus-within:ring-fg-4/30`}
      >
        <label htmlFor="max" className="pr-1.5 pl-3 text-[13px] font-medium whitespace-nowrap text-fg-2">
          Budget <span aria-hidden="true" className="text-fg">₱</span>
          <span className="sr-only">, most you can spend in pesos</span>
        </label>
        <input
          id="max"
          name="max"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Any"
          aria-invalid={budgetInvalid.max || undefined}
          aria-describedby={budgetInvalid.max ? "budget-errors" : undefined}
          value={values.max}
          onChange={onTextChange}
          onFocus={onTextFocus}
          onBlur={onTextBlur}
          className="h-full w-full min-w-0 rounded-r-lg bg-transparent pr-3 text-base font-[590] text-fg tabular-nums placeholder:font-normal placeholder:text-fg-3 focus:outline-none sm:text-[15px]"
        />
      </div>

      <div className="relative sm:min-w-36 sm:flex-[1_1_10rem]">
        <label htmlFor="q" className="sr-only">
          Search promo or provider names
        </label>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="q"
          name="q"
          type="search"
          maxLength={60}
          autoComplete="off"
          placeholder="Search"
          value={values.q}
          onChange={onTextChange}
          onFocus={onTextFocus}
          onBlur={onTextBlur}
          className={`${FIELD} h-11 w-full pl-9 sm:h-10`}
        />
      </div>

      <fieldset className="min-w-0 sm:shrink-0">
        <legend className="sr-only">How long the promo lasts</legend>
        <div>
          <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-line bg-surface p-[3px] sm:flex sm:w-max">
            {validityOptions.map((option) => {
              const checked = values.validity === option.value;
              return (
                <label
                  key={option.value || "any"}
                  className={`flex h-10 cursor-pointer items-center justify-center rounded-md px-2 text-[13px] whitespace-nowrap sm:h-8 sm:px-2.5 ${
                    checked ? "bg-selected font-[590] text-fg" : "font-medium text-fg-3 hover:text-fg"
                  } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fg-2`}
                >
                  <input
                    type="radio"
                    name="validity"
                    value={option.value}
                    checked={checked}
                    onChange={() => change("validity", option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>
      </fieldset>

        <button
          type="button"
          popoverTarget={FILTERS_ID}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong focus-visible:outline-2 sm:h-10 sm:shrink-0 sm:px-3"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
          {sheetCount > 0 ? (
            <span className="rounded-full bg-selected px-1.5 text-[11px] leading-[18px] tabular-nums">
              {sheetCount}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </button>
      </div>

      {children ? <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div> : null}
      {/* Sort lives on the results bar above the list; this keeps it in the no-JavaScript form. */}
      <input type="hidden" name="sort" value={values.sort} />

      <p role="status" className="sr-only">
        {pending ? "Updating results" : ""}
      </p>
      <noscript>
        <button type="submit" className="h-10 rounded-lg bg-fg px-4 text-sm font-[590] text-canvas">
          Apply
        </button>
      </noscript>

      <div
        id={FILTERS_ID}
        popover="auto"
        role="dialog"
        aria-labelledby={`${FILTERS_ID}-title`}
        className="inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-auto max-w-none overflow-y-auto sm:inset-0 rounded-t-2xl border border-b-0 border-line-strong bg-raised text-fg sm:m-auto sm:shadow-[0_24px_60px_rgb(0_0_0/0.6)] sm:w-[26rem] sm:rounded-2xl sm:border-b"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center justify-between border-b border-line py-2 pr-2 pl-5">
          <h2 id={`${FILTERS_ID}-title`} className="text-[17px] font-[590] tracking-[-0.01em]">
            Filters
          </h2>
          <button
            type="button"
            popoverTarget={FILTERS_ID}
            popoverTargetAction="hide"
            aria-label="Close filters"
            className="flex size-11 items-center justify-center rounded-lg text-fg-3 hover:bg-raised hover:text-fg focus-visible:outline-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium">
              Providers <span className="font-normal text-fg-4">(pick any; none means all)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => {
                const checked = values.providers.includes(provider.value);
                return (
                  <label
                    key={provider.value}
                    className={`flex h-10 cursor-pointer items-center rounded-lg border px-3.5 text-[13px] transition-colors ${
                      checked
                        ? "border-fg-3 bg-selected font-[590] text-fg"
                        : "border-line bg-surface font-medium text-fg-2 hover:border-line-strong"
                    } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fg-2`}
                  >
                    <input
                      type="checkbox"
                      name="provider"
                      value={provider.value}
                      checked={checked}
                      onChange={() =>
                        change(
                          "providers",
                          checked
                            ? values.providers.filter((id) => id !== provider.value)
                            : [...values.providers, provider.value],
                        )
                      }
                      className="sr-only"
                    />
                    {provider.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="compatibility" className="text-[13px] font-medium">
              Your phone
            </label>
            <select
              id="compatibility"
              name="compatibility"
              value={values.compatibility}
              onChange={(event) => change("compatibility", event.target.value)}
              className={`${FIELD} h-11`}
            >
              {compatibilityOptions.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-fg-4">
              &ldquo;Works on a 4G phone&rdquo; hides promos that need a 5G phone. &ldquo;5G phone only&rdquo; shows just those.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="min" className="text-[13px] font-medium">
              Lowest price, ₱ <span className="font-normal text-fg-4">(optional)</span>
            </label>
            <input
              id="min"
              name="min"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={budgetInvalid.min || undefined}
              aria-describedby={budgetInvalid.min ? "budget-errors" : undefined}
              value={values.min}
              onChange={onTextChange}
              onFocus={onTextFocus}
              onBlur={onTextBlur}
              className={`${FIELD} h-11 tabular-nums`}
            />
          </div>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-fg-2">
            Include promos no longer offered
            <input
              type="checkbox"
              name="inactive"
              value="1"
              checked={values.inactive}
              onChange={(event) => change("inactive", event.target.checked)}
              className="size-5 shrink-0 accent-fg"
            />
          </label>
        </div>

        <div className="grid grid-cols-[1fr_2fr] gap-2 border-t border-line px-4 pt-3 pb-5">
          <button
            type="button"
            onClick={() => {
              const next = { ...values, providers: [], compatibility: "", min: "", inactive: false };
              setValues(next);
              go(next);
            }}
            className="h-12 rounded-lg border border-line bg-surface text-sm font-medium text-fg-2 transition-colors hover:border-line-strong hover:text-fg focus-visible:outline-2"
          >
            Clear
          </button>
          <button
            type="button"
            popoverTarget={FILTERS_ID}
            popoverTargetAction="hide"
            aria-live="polite"
            className="h-12 rounded-lg border border-fg-3 bg-selected text-sm font-[590] text-fg transition-colors hover:border-fg-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {pending
              ? "Updating…"
              : resultCount === 0
                ? "No promos match"
                : `Show ${resultCount} ${resultCount === 1 ? "promo" : "promos"}`}
          </button>
        </div>
      </div>
    </form>
  );
}
