/**
 * Period maths for the Lottery analytics pages — all in MYANMAR TIME.
 *
 * A period is a pair of MMT calendar dates `from`..`to` (YYYY-MM-DD,
 * inclusive) that the backend converts to UTC instants. "Today" is the
 * current MMT date — the browser's own zone is never consulted: the clock is
 * read by shifting `Date.now()` by the fixed offset and reading UTC fields,
 * the same arithmetic lib/myanmar-time.ts uses. Day arithmetic runs on day
 * numbers (days since the epoch, UTC) so no DST or zone rule can shift a
 * date across midnight.
 *
 * Pure functions, no React, no translations — the words live in format.ts.
 */

import { MYANMAR_UTC_OFFSET_MINUTES } from "@/lib/myanmar-time";
import { LOTTERY_ANALYTICS_MAX_RANGE_DAYS } from "@/types/lottery-analytics";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** The dashboard's period chips, in the order they are drawn. */
export const DASHBOARD_PERIODS = ["today", "yesterday", "last7", "last30", "month", "custom"] as const;
export type DashboardPeriodKey = (typeof DASHBOARD_PERIODS)[number];

/** The reports page's chips: "all" sends no dates at all. */
export const REPORT_PERIODS = ["all", "last7", "last30", "month", "custom"] as const;
export type ReportPeriodKey = (typeof REPORT_PERIODS)[number];

export type PeriodKey = DashboardPeriodKey | ReportPeriodKey;

/** Two MMT calendar dates, inclusive. */
export interface DateRange {
  from: string;
  to: string;
}

/** The MMT wall clock at an instant. */
export interface MmtClock {
  /** YYYY-MM-DD */
  date: string;
  hour: number;
  minute: number;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** True for a well-formed "YYYY-MM-DD" that names a real calendar day. */
export function isYmd(value: string): boolean {
  const match = YMD.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}

/** Days since the epoch for a "YYYY-MM-DD" (NaN for a bad one). */
export function ymdToDayNumber(ymd: string): number {
  const match = YMD.exec(ymd);
  if (!match) return Number.NaN;
  const [, y, m, d] = match.map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function dayNumberToYmd(day: number): string {
  const date = new Date(day * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(ymd: string, days: number): string {
  return dayNumberToYmd(ymdToDayNumber(ymd) + days);
}

/** How many calendar days `from`..`to` covers, inclusive (0 or less when reversed). */
export function daySpan(range: DateRange): number {
  return ymdToDayNumber(range.to) - ymdToDayNumber(range.from) + 1;
}

/** 0 = Monday … 6 = Sunday, the wire's own weekday numbering. */
export function weekdayIndex(ymd: string): number {
  // Day 0 (1 Jan 1970) was a Thursday: index 3 in a Monday-first week.
  return (((ymdToDayNumber(ymd) + 3) % 7) + 7) % 7;
}

/** The first day of the month `ymd` falls in. */
export function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** The MMT wall clock now. */
export function mmtClock(nowMs: number): MmtClock {
  const shifted = new Date(nowMs + MYANMAR_UTC_OFFSET_MINUTES * MINUTE_MS);
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** The current MMT date. */
export function mmtToday(nowMs: number): string {
  return mmtClock(nowMs).date;
}

/** The MMT calendar date an ISO instant falls on; null for an unreadable one. */
export function mmtDateOfIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : mmtToday(ms);
}

/**
 * The dates a dashboard chip stands for. Today and This month include today;
 * Last 7 / Last 30 days are the FULL days before today. A custom chip with
 * no range yet falls back to the last 7 days.
 */
export function resolveDashboardPeriod(
  key: DashboardPeriodKey,
  custom: DateRange | null,
  nowMs: number,
): DateRange {
  const today = mmtToday(nowMs);
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "last7":
      return { from: addDays(today, -7), to: addDays(today, -1) };
    case "last30":
      return { from: addDays(today, -30), to: addDays(today, -1) };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "custom":
      return custom ?? { from: addDays(today, -7), to: addDays(today, -1) };
  }
}

/** The reports page's chips; null = all time (the request carries no dates). */
export function resolveReportPeriod(
  key: ReportPeriodKey,
  custom: DateRange | null,
  nowMs: number,
): DateRange | null {
  if (key === "all") return null;
  return resolveDashboardPeriod(key, custom, nowMs);
}

/** The comparison period: the same number of days immediately before `from`. */
export function previousRange(range: DateRange): DateRange {
  const len = daySpan(range);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

export type CustomRangeProblem = "enterBoth" | "endBeforeStart" | "endAfterToday" | "tooLong";

/** Why a typed custom range cannot be applied, or null when it can. */
export function customRangeProblem(from: string, to: string, today: string): CustomRangeProblem | null {
  if (!isYmd(from) || !isYmd(to)) return "enterBoth";
  if (ymdToDayNumber(to) < ymdToDayNumber(from)) return "endBeforeStart";
  if (ymdToDayNumber(to) > ymdToDayNumber(today)) return "endAfterToday";
  if (daySpan({ from, to }) > LOTTERY_ANALYTICS_MAX_RANGE_DAYS) return "tooLong";
  return null;
}

/** How many Mondays, Tuesdays … the range holds (Monday first) — the "across 3 Tuesdays" of the Busiest days card. */
export function weekdayCounts(range: DateRange): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const first = ymdToDayNumber(range.from);
  const last = ymdToDayNumber(range.to);
  if (Number.isNaN(first) || Number.isNaN(last) || last < first) return counts;
  for (let day = first; day <= last; day++) counts[(((day + 3) % 7) + 7) % 7]++;
  return counts;
}

/** Every date of the range, in order — the daily view's x-axis when the backend zero-fills by day. */
export function datesOf(range: DateRange): string[] {
  const first = ymdToDayNumber(range.from);
  const last = ymdToDayNumber(range.to);
  if (Number.isNaN(first) || Number.isNaN(last) || last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, i) => dayNumberToYmd(first + i));
}

/** The Monday of the week `ymd` falls in. */
export function mondayOf(ymd: string): string {
  return addDays(ymd, -weekdayIndex(ymd));
}

/** Can the dashboard's Daily / Weekly views be drawn for this many days? */
export function viewAvailability(days: number): { daily: boolean; weekly: boolean } {
  return { daily: days > 1, weekly: days >= 14 };
}

/** The view actually drawn: the one asked for, or the widest one the period allows. */
export function effectiveChartView(
  wanted: "hourly" | "daily" | "weekly",
  days: number,
): "hourly" | "daily" | "weekly" {
  const can = viewAvailability(days);
  if (wanted === "weekly") return can.weekly ? "weekly" : can.daily ? "daily" : "hourly";
  if (wanted === "daily") return can.daily ? "daily" : "hourly";
  return "hourly";
}
