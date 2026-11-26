"use client";

import { useSyncExternalStore } from "react";
import { parsePicks, togglePick, type PickedPromo } from "@/lib/compare/selection";

/**
 * Compare picks kept in sessionStorage: they survive filter changes and
 * "Show more" in the open tab, and disappear when the tab closes. Storage can
 * be unavailable (private browsing); the picks then live in memory only.
 */

const KEY = "teleranker:compare";
const CHANGE = "teleranker:compare-change";
const EMPTY: PickedPromo[] = [];

let memory: string | null = null;
let cachedRaw: string | null = null;
let cachedPicks: PickedPromo[] = EMPTY;
let notice: string | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function writeRaw(value: string | null) {
  memory = value;
  try {
    if (value === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, value);
  } catch {
    // Storage blocked: keep the in-memory copy.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getPicks(): PickedPromo[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPicks = parsePicks(raw);
  }
  return cachedPicks;
}

const getServerPicks = () => EMPTY;

/** The current picks; empty on the server and before the page hydrates. */
export function useComparePicks(): PickedPromo[] {
  return useSyncExternalStore(subscribe, getPicks, getServerPicks);
}

/** A short message for the tray (for example a refused third pick); null when none. */
export function useCompareNotice(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => notice,
    () => null,
  );
}

export function showCompareNotice(message: string) {
  notice = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice = null;
    window.dispatchEvent(new Event(CHANGE));
  }, 4000);
  window.dispatchEvent(new Event(CHANGE));
}

/** Picks or unpicks a promo; returns false when a third pick was refused. */
export function toggleComparePick(item: PickedPromo): boolean {
  const result = togglePick(getPicks(), item);
  if (result.refused) {
    showCompareNotice("You can compare 2 at a time. Remove one first.");
    return false;
  }
  writeRaw(result.picks.length ? JSON.stringify(result.picks) : null);
  return true;
}

export function clearComparePicks() {
  writeRaw(null);
}
