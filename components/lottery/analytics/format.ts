/**
 * Words and numbers for the Lottery analytics pages: counts, percentages,
 * MMT hour labels, dates in the boards' "Thu 16–Wed 22 Oct 2026" style, the
 * range line and the draw-select labels. Every string goes through `t`, so
 * the Burmese page reads Burmese weekdays and hours.
 */
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmtDate } from "@/lib/myanmar-time";
import type { LotteryAdminDraw, LotteryDrawStatus } from "@/types/lottery";
import {
  type DashboardPeriodKey,
  type DateRange,
  type MmtClock,
  type ReportPeriodKey,
  daySpan,
  mmtClock,
  previousRange,
  weekdayIndex,
  ymdToDayNumber,
} from "@/components/lottery/analytics/period";

/** "12,345" — the admin's en-US grouping everywhere, in both languages. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

/** A 0–1 share as "6.1%" (one decimal) or "58%" (none). */
export function formatShare(share: number | null | undefined, decimals = 1): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return "—";
  return `${(share * 100).toFixed(decimals)}%`;
}

/** A change ratio as "+14%", "−4%" or "0%" — the sign is text, never colour alone. */
export function formatSignedPct(changePct: number): string {
  const pct = Math.round(changePct * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `−${Math.abs(pct)}%`;
  return "0%";
}

/** "2.4" — the average tickets per transaction. */
export function formatAverage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

/** "2:00 PM" for hour 14. */
export function hourLabel(t: TranslationShape, hour: number): string {
  return t.lottery.analytics.hourLabels[((hour % 24) + 24) % 24] ?? String(hour);
}

/** "2:00 PM–3:00 PM" — the hour bucket that starts at `hour`. */
export function hourRangeLabel(t: TranslationShape, hour: number): string {
  return t.lottery.analytics.hourRange(hourLabel(t, hour), hourLabel(t, (hour + 1) % 24));
}

/** "3:40 PM" for an MMT wall clock. */
export function clockLabel(t: TranslationShape, clock: Pick<MmtClock, "hour" | "minute">): string {
  const a = t.lottery.analytics;
  const half = a.dayHalves[clock.hour < 12 ? 0 : 1];
  const hour12 = clock.hour % 12 === 0 ? 12 : clock.hour % 12;
  return a.clock(half, hour12, String(clock.minute).padStart(2, "0"));
}

function parts(ymd: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

/** "Thu 16 Oct" (withYear: "Thu 16 Oct 2026"). */
export function formatDay(t: TranslationShape, ymd: string, withYear = false): string {
  const a = t.lottery.analytics;
  const p = parts(ymd);
  if (!p) return ymd;
  const weekday = a.weekdaysShort[weekdayIndex(ymd)];
  const month = a.monthsShort[p.month] ?? "";
  return withYear ? a.date.dayYear(weekday, p.day, month, p.year) : a.date.day(weekday, p.day, month);
}

/** "16 Oct" (withYear: "16 Oct 2026") — no weekday. */
export function formatShortDate(t: TranslationShape, ymd: string, withYear = false): string {
  const a = t.lottery.analytics;
  const p = parts(ymd);
  if (!p) return ymd;
  const month = a.monthsShort[p.month] ?? "";
  return withYear ? a.date.shortYear(p.day, month, p.year) : a.date.short(p.day, month);
}

/**
 * "Thu 16–Wed 22 Oct 2026", "Wed 23 Sep–Thu 22 Oct 2026", a single day as
 * "Fri 23 Oct 2026"; across a year boundary both ends carry their year.
 */
export function formatRange(t: TranslationShape, range: DateRange, withYear = true): string {
  const a = t.lottery.analytics;
  const from = parts(range.from);
  const to = parts(range.to);
  if (!from || !to) return `${range.from}–${range.to}`;
  if (range.from === range.to) return formatDay(t, range.from, withYear);
  const fromWeekday = a.weekdaysShort[weekdayIndex(range.from)];
  const end = formatDay(t, range.to, withYear);
  if (from.year !== to.year) return a.date.span(formatDay(t, range.from, true), end);
  if (from.month === to.month) return a.date.span(`${fromWeekday} ${from.day}`, end);
  return a.date.span(formatDay(t, range.from, false), end);
}

/** The draw select's option: "Draw 3 · 31 Oct (Open)"; a published draw needs no status. */
export function drawOptionLabel(
  t: TranslationShape,
  draw: Pick<LotteryAdminDraw, "drawNo" | "thaiDrawDate" | "status">,
): string {
  const a = t.lottery.analytics;
  const date = formatShortDate(t, draw.thaiDrawDate);
  if (draw.status === "published") return a.filters.drawOption(draw.drawNo, date);
  return a.filters.drawOptionStatus(draw.drawNo, date, t.lottery.draws.statuses[draw.status]);
}

/** "Draw 3" — the short name used inside sentences. */
export function drawShortLabel(t: TranslationShape, drawNo: number): string {
  return t.lottery.draws.drawLabel(drawNo);
}

/** The wire's status word, through the draws page's own strings. */
export function drawStatusLabel(t: TranslationShape, status: LotteryDrawStatus): string {
  return t.lottery.draws.statuses[status];
}

/** "26 Sep 2026–2 Oct 2026" from a draw's opening and closing instants (MMT); "(so far)" while it still sells. */
export function salesWindowText(t: TranslationShape, draw: LotteryAdminDraw): string {
  const from = formatMmtDate(draw.openedAt ?? draw.createdAt);
  const to = formatMmtDate(draw.salesCloseAt);
  const span = t.lottery.analytics.date.span(from, to);
  return draw.status === "open" || draw.status === "paused"
    ? `${span} (${t.lottery.analytics.reports.byDraw.salesSoFar})`
    : span;
}

/** The dashboard's range text: "Last 7 days · Thu 16–Wed 22 Oct 2026". */
export function dashboardRangeText(
  t: TranslationShape,
  key: DashboardPeriodKey,
  range: DateRange,
  nowMs: number,
): string {
  const a = t.lottery.analytics;
  const clock = mmtClock(nowMs);
  const time = clockLabel(t, clock);
  switch (key) {
    case "today":
      return a.range.today(formatDay(t, range.from, true), time);
    case "yesterday":
      return a.range.yesterday(formatDay(t, range.from, true));
    case "last7":
      return a.range.last7(formatRange(t, range));
    case "last30":
      return a.range.last30(formatRange(t, range));
    case "month":
      return a.range.month(formatRange(t, range), time);
    case "custom":
      return a.range.custom(formatRange(t, range));
  }
}

/** The reports page's range text; "All time · since 26 Sep 2026" when the first sale is known. */
export function reportRangeText(
  t: TranslationShape,
  key: ReportPeriodKey,
  range: DateRange | null,
  nowMs: number,
  firstSaleDate: string | null,
): string {
  const a = t.lottery.analytics;
  if (key === "all" || !range) {
    return firstSaleDate ? a.range.allTimeSince(formatDay(t, firstSaleDate, true)) : a.range.allTime;
  }
  return dashboardRangeText(t, key, range, nowMs);
}

/**
 * The comparison period in the three shapes the cards need, so no template
 * has to guess an article or preposition:
 * - `vs` after "vs": "previous 7 days" · "all of yesterday" · "Wed 21 Oct";
 * - `same` after "Same as": "the previous 7 days" · "yesterday" · "Wed 21 Oct";
 * - `in` after "Was …" / "Also first": "in the previous 7 days" · "yesterday" · "on Wed 21 Oct".
 * `partialDay` is true for Today, whose figures are a part-day against the
 * whole of yesterday.
 */
export interface ComparisonWords {
  vs: string;
  same: string;
  in: string;
  partialDay: boolean;
}

export function comparisonWords(t: TranslationShape, key: DashboardPeriodKey, range: DateRange): ComparisonWords {
  const r = t.lottery.analytics.range;
  const days = daySpan(range);
  if (days === 1) {
    if (key === "today") return { vs: r.vsYesterday, same: r.sameYesterday, in: r.inYesterday, partialDay: true };
    const date = formatDay(t, previousRange(range).from, false);
    return { vs: date, same: date, in: r.onDay(date), partialDay: false };
  }
  return { vs: r.vsDays(days), same: r.sameDays(days), in: r.inDays(days), partialDay: false };
}

/**
 * The "Compared with …" part of the range line. Null `firstSaleDate` or a
 * first sale after the comparison window's start = no earlier data (with a
 * draw selected `firstSaleDate` is that draw's own first sale — the
 * backend scopes it — so the draw wording is exact). Today says that the
 * comparison is with the WHOLE of yesterday.
 */
export function compareText(
  t: TranslationShape,
  key: DashboardPeriodKey,
  range: DateRange,
  firstSaleDate: string | null,
  drawLabel: string | null,
): string {
  const a = t.lottery.analytics;
  const previous = previousRange(range);
  const covered = firstSaleDate !== null && ymdToDayNumber(firstSaleDate) <= ymdToDayNumber(previous.from);
  if (!covered) {
    if (drawLabel) return a.range.noEarlierDataDraw(drawLabel, comparisonWords(t, key, range).in);
    return firstSaleDate
      ? a.range.noEarlierDataSince(formatDay(t, firstSaleDate, true))
      : a.range.noEarlierData;
  }
  const days = daySpan(range);
  if (days === 1) {
    const date = formatDay(t, previous.from, false);
    return key === "today" ? a.range.comparedWithWholeDay(date) : a.range.comparedWithDay(date);
  }
  return a.range.comparedWith(days, formatRange(t, previous, false));
}

/**
 * "Fri 23 Oct 2026, 3:40 PM" — the header's "Updated …" stamp, in the same
 * 12-hour clock the rest of the page uses (the range line, the axis note,
 * the tooltips), never the 24-hour formatMmt of the draws pages.
 */
export function updatedStamp(t: TranslationShape, atMs: number): string {
  const clock = mmtClock(atMs);
  return `${formatDay(t, clock.date, true)}, ${clockLabel(t, clock)}`;
}

/** The weekday name for a wire key ("mon".."sun"), or the key when unknown. */
export function weekdayNameFromKey(t: TranslationShape, key: string): string {
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const index = keys.indexOf(key);
  return index === -1 ? key : t.lottery.analytics.weekdays[index];
}
