/** Shared classes, so the Compare table and Plan's results line up in the same columns. */

export const GRID = "grid grid-cols-[30%_35%_35%]";

/** Bleeds to the screen edge on phones; the label cell adds the inset back. */
export const TABLE_BLEED = "max-sm:-mx-4";

export const ROW = `${GRID} border-b border-line-soft`;

export const LABEL_CELL =
  "py-[11px] pr-2 pl-4 text-[13px] leading-snug text-fg-2 sm:pl-0 md:py-3 md:pr-3 md:text-sm";

export const VALUE_CELL =
  "min-w-0 border-l border-line-soft px-2.5 py-[11px] text-[13px] leading-snug break-words md:px-4 md:py-3 md:text-sm";

/** The banded background for a row where one promo is ahead. */
export const BAND = "bg-band";

/** Value colour: matching values grey, the promo that is ahead bold white, the rest light grey. */
export function valueTone(same: boolean, leads: boolean): string {
  if (same) return "text-fg-4";
  return leads ? "font-[590] text-white" : "text-fg-2";
}

export const TAG =
  "mt-1 block w-fit rounded bg-selected px-1.5 py-px text-[11px] font-medium text-fg md:mt-0 md:ml-2 md:inline";
