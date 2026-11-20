/**
 * Minimal RFC 4180 CSV parser for the manual promo sheet.
 *
 * Handles quoted fields, escaped quotes (""), commas and line breaks inside
 * quotes, CRLF line endings and a UTF-8 byte-order mark. Written in-house so
 * the import needs no new dependency.
 */

export interface CsvRecord {
  /** 1-based line number of the record's first line, for error messages. */
  line: number;
  values: Record<string, string>;
}

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  /** True right after a closing quote: only a comma or line end may follow. */
  let closedQuote = false;
  let line = 1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "\n") line += 1;

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (closedQuote && char !== "," && char !== "\n" && char !== "\r") {
      throw new Error(
        `line ${line}: unexpected text after a closing quote; a quoted value must be followed by a comma or a line break`,
      );
    }
    closedQuote = false;

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error("the file ends inside a quoted value (a closing quote is missing)");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Parses CSV text with a header row into records keyed by column name. */
export function parseCsvRecords(text: string): { header: string[]; records: CsvRecord[] } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { header: [], records: [] };

  const header = rows[0].map((name) => name.trim());
  const records: CsvRecord[] = [];
  let line = 1;

  for (const row of rows.slice(1)) {
    line += 1;
    // Count embedded line breaks so later line numbers stay accurate.
    const extraLines = row.reduce((sum, value) => sum + (value.match(/\r?\n/g)?.length ?? 0), 0);
    const recordLine = line;
    line += extraLines;

    if (row.every((value) => value.trim() === "")) continue;

    const values: Record<string, string> = {};
    header.forEach((name, index) => {
      values[name] = (row[index] ?? "").trim();
    });
    records.push({ line: recordLine, values });
  }

  return { header, records };
}
