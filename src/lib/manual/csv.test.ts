import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords, toCsv } from "./csv";

describe("parseCsv", () => {
  it("splits plain fields and CRLF lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas, quotes and line breaks inside quoted fields", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });

  it("strips a UTF-8 byte-order mark", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("keeps empty trailing fields", () => {
    expect(parseCsv("a,b,c\n1,,\n")[1]).toEqual(["1", "", ""]);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('a\n"open')).toThrow(/closing quote is missing/);
  });

  it("rejects text after a closing quote, with the line number", () => {
    expect(() => parseCsv('a,b\n1,"5GB" bonus\n')).toThrow(
      /line 2: unexpected text after a closing quote/,
    );
    expect(() => parseCsv('a\n"x"y')).toThrow(/line 2/);
  });

  it("allows a quoted value at the end of a line or the file", () => {
    expect(parseCsv('a,b\r\n"x","y"\r\n"z",""')).toEqual([
      ["a", "b"],
      ["x", "y"],
      ["z", ""],
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("keys values by header, trims them and skips blank rows", () => {
    const { header, records } = parseCsvRecords("id, name \n1, One \n,\n2,Two\n");
    expect(header).toEqual(["id", "name"]);
    expect(records).toEqual([
      { line: 2, values: { id: "1", name: "One" } },
      { line: 4, values: { id: "2", name: "Two" } },
    ]);
  });

  it("reports line numbers after multi-line fields", () => {
    const { records } = parseCsvRecords('id,note\n1,"two\nlines"\n2,x\n');
    expect(records.map((record) => record.line)).toEqual([2, 4]);
  });
});

describe("toCsv", () => {
  it("quotes only fields that need it and ends lines with CRLF", () => {
    expect(toCsv([["id", "note"], ["1", 'say "hi", twice'], ["2", "two\nlines"], ["3", ""]])).toBe(
      'id,note\r\n1,"say ""hi"", twice"\r\n2,"two\nlines"\r\n3,\r\n',
    );
  });

  it("round-trips through the parser", () => {
    const rows = [["a", "b"], ["x,y", '"q"'], ["", "line\r\nbreak"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
