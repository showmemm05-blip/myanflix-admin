/**
 * The analytics cards' "Export CSV": encode (lib/csv.ts) and hand the file
 * to the browser (the Dreams page's saveBlob). File names carry the MMT
 * dates of the selection so two exports never overwrite each other.
 */
import { saveBlob } from "@/components/lottery/dreamFormat";
import { csvBlob, type CsvValue } from "@/lib/csv";
import type { DateRange } from "@/components/lottery/analytics/period";

export type { CsvValue } from "@/lib/csv";
export { csvText } from "@/lib/csv";

/** `${stem}_${from}_${to}.csv`, or `${stem}_all-time.csv` when the selection has no dates. */
export function csvFileName(stem: string, range: DateRange | null, suffix?: string): string {
  const scope = range ? `${range.from}_${range.to}` : "all-time";
  return `${stem}${suffix ? `_${suffix}` : ""}_${scope}.csv`;
}

export function downloadCsv(
  fileName: string,
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): void {
  saveBlob(csvBlob(headers, rows), fileName);
}

/** A 0–1 share as a percentage with one decimal, for a CSV cell ("6.1"). */
export function csvPct(share: number | null | undefined): string {
  return share === null || share === undefined ? "" : (share * 100).toFixed(1);
}
