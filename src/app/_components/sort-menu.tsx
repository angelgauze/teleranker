"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Sort as a text button over a native select (the phone's own picker); keeps every filter. */
export function SortMenu({
  value,
  options,
  query,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  /** The listing's current address query without `sort` and `show`. */
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <label
      className={`relative flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-[13px] text-fg-3 hover:bg-raised hover:text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fg-2 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <span>
        Sort<span className="hidden sm:inline">:</span>{" "}
        <span className="hidden font-medium text-fg sm:inline">{current.label}</span>
      </span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label="Sort promos"
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(query);
          if (event.target.value === "value") params.delete("sort");
          else params.set("sort", event.target.value);
          const next = params.toString();
          startTransition(() => router.replace(next ? `/?${next}` : "/", { scroll: false }));
        }}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
