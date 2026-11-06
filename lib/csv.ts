/**
 * CSV encoding for the admin's exports (2026-10-23, first used by the
 * Lottery analytics pages). RFC 4180: comma-separated, CRLF line ends, a
 * field is quoted when it holds a comma, a quote or a line break, and a
 * quote inside a field is doubled. The file starts with a UTF-8 BOM so Excel
 * opens Burmese text as UTF-8 instead of guessing the code page.
 *
 * Pure: the download itself (an object URL and a click) is the caller's —
 * see components/lottery/analytics/csv.ts.
 */

export type CsvValue = string | number | boolean | null | undefined;

export const CSV_MIME = "text/csv;charset=utf-8";

const UTF8_BOM = "﻿";

/** One field, quoted only when RFC 4180 says it must be. An absent value is an empty field. */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * An identifier that only LOOKS like a number — a six-digit lottery number
 * such as 000007 — written so a spreadsheet keeps it as text. Excel, Numbers
 * and Sheets all read a bare `000007` as the number 7 and quoting does not
 * stop them; the one form they all honour is the text formula `="000007"`,
 * which evaluates to the string. csvField then quotes the whole field and
 * doubles the inner quotes as RFC 4180 asks (`"=""000007"""`); a plain CSV
 * parser gets `="000007"` back with the digits intact.
 */
export function csvText(value: string): string {
  return `="${value.replace(/"/g, '""')}"`;
}

/** The header row then one row per entry, CRLF-terminated, BOM first. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(","));
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}

/** The same text as a Blob the browser can save. */
export function csvBlob(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): Blob {
  return new Blob([toCsv(headers, rows)], { type: CSV_MIME });
}
