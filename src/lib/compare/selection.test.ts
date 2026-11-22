import { describe, expect, it } from "vitest";
import { compareHref, MAX_PICKS, parsePicks, togglePick, type PickedPromo } from "./selection";

const a: PickedPromo = { id: "a1", name: "Promo A" };
const b: PickedPromo = { id: "b2", name: "Promo B" };
const c: PickedPromo = { id: "c3", name: "Promo C" };

describe("togglePick", () => {
  it("allows two picks", () => {
    expect(MAX_PICKS).toBe(2);
    const one = togglePick([], a);
    const two = togglePick(one.picks, b);
    expect(two).toEqual({ picks: [a, b], refused: false });
  });

  it("refuses a third pick and keeps the first two", () => {
    expect(togglePick([a, b], c)).toEqual({ picks: [a, b], refused: true });
  });

  it("unpicks a promo that is already picked", () => {
    expect(togglePick([a, b], a)).toEqual({ picks: [b], refused: false });
  });
});

describe("parsePicks", () => {
  it("reads saved picks", () => {
    expect(parsePicks(JSON.stringify([a, b]))).toEqual([a, b]);
  });

  it("returns no picks for missing or broken data", () => {
    expect(parsePicks(null)).toEqual([]);
    expect(parsePicks("not json")).toEqual([]);
    expect(parsePicks(JSON.stringify({ id: "a1" }))).toEqual([]);
  });

  it("drops malformed entries, duplicates and anything past two", () => {
    const saved = JSON.stringify([a, { id: 5, name: "x" }, a, { id: "", name: "x" }, b, c]);
    expect(parsePicks(saved)).toEqual([a, b]);
  });
});

describe("compareHref", () => {
  it("links to the compare page with both ids", () => {
    expect(compareHref([a, b])).toBe("/compare?id=a1&id=b2");
  });

  it("encodes ids safely", () => {
    expect(compareHref([{ id: "x&y", name: "X" }, b])).toBe("/compare?id=x%26y&id=b2");
  });
});
