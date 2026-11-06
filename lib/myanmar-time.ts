/**
 * Myanmar time for the Lottery pages. The backend stores every instant in
 * UTC and the apps show Myanmar time (UTC+6:30, no daylight saving — the
 * backend's YANGON_UTC_OFFSET_MINUTES in bank-events/risk-rules.ts), so the
 * draws and tickets pages label their times "MMT" and format them here
 * instead of in the browser's own zone, which need not be Myanmar's.
 *
 * Arithmetic on the fixed offset, not Intl's zone tables: the offset never
 * changes, and the same sum runs the same in Node (the build) and in every
 * browser.
 */

export const MYANMAR_UTC_OFFSET_MINUTES = 390;
const MINUTE_MS = 60_000;

/**
 * The Thai draw: 14:30 Asia/Bangkok = 07:30 UTC = 14:00 Myanmar, on the
 * draw date. The backend sets `drawAt` from the same rule.
 */
const THAI_DRAW_TIME_UTC = "07:30:00.000Z";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date whose UTC fields read as Myanmar wall-clock time, or null for an unreadable instant. */
function toMmtClock(iso: string): Date | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(ms + MYANMAR_UTC_OFFSET_MINUTES * MINUTE_MS);
}

/** "19 Oct 2026, 13:00" in Myanmar time; "—" for a missing or unreadable instant. */
export function formatMmt(iso: string | null | undefined): string {
  if (!iso || !toMmtClock(iso)) return "—";
  return `${formatMmtDate(iso)}, ${formatMmtTime(iso)}`;
}

/** "19 Oct 2026" in Myanmar time. */
export function formatMmtDate(iso: string): string {
  const clock = toMmtClock(iso);
  if (!clock) return "—";
  return `${clock.getUTCDate()} ${MONTHS[clock.getUTCMonth()]} ${clock.getUTCFullYear()}`;
}

/** "13:00" in Myanmar time. */
export function formatMmtTime(iso: string): string {
  const clock = toMmtClock(iso);
  if (!clock) return "—";
  return `${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`;
}

/** A "YYYY-MM-DD" date (the Thai draw date) as "16 Oct 2026" — no zone involved. */
export function formatDateOnly(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, y, m, d] = match;
  const month = MONTHS[Number(m) - 1];
  return month ? `${Number(d)} ${month} ${y}` : date;
}

/**
 * The value a `datetime-local` input shows for an instant, read as Myanmar
 * wall-clock time ("YYYY-MM-DDTHH:mm"). Pair it with `fromMmtInputValue`.
 */
export function toMmtInputValue(iso: string): string {
  const clock = toMmtClock(iso);
  if (!clock) return "";
  return `${clock.getUTCFullYear()}-${pad(clock.getUTCMonth() + 1)}-${pad(clock.getUTCDate())}T${pad(
    clock.getUTCHours(),
  )}:${pad(clock.getUTCMinutes())}`;
}

/** A `datetime-local` value typed as Myanmar time → the UTC ISO instant, or null when unreadable. */
export function fromMmtInputValue(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min, s] = match;
  const ms =
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s ?? 0)) -
    MYANMAR_UTC_OFFSET_MINUTES * MINUTE_MS;
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** When the Thai draw happens for a "YYYY-MM-DD" draw date. */
export function thaiDrawAtIso(thaiDrawDate: string): string {
  return `${thaiDrawDate}T${THAI_DRAW_TIME_UTC}`;
}

/** The closing time the settings imply for a draw date: the draw minus the offset. */
export function defaultSalesCloseIso(thaiDrawDate: string, minutesBefore: number): string | null {
  const drawMs = new Date(thaiDrawAtIso(thaiDrawDate)).getTime();
  if (Number.isNaN(drawMs)) return null;
  return new Date(drawMs - minutesBefore * MINUTE_MS).toISOString();
}

/**
 * The settings page's example: where sales close relative to draw day for a
 * given offset. More than 14 hours before 14:00 lands on the day before.
 */
export function salesCloseOnDrawDay(minutesBefore: number): { time: string; dayBefore: boolean } {
  const drawMinutes = 14 * 60;
  let minutes = drawMinutes - minutesBefore;
  const dayBefore = minutes < 0;
  if (dayBefore) minutes += 24 * 60;
  return { time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`, dayBefore };
}

/**
 * The next Thai draw date after today (Myanmar date): the lottery draws on
 * the 1st and the 16th of every month. Today itself is never offered — a
 * draw created on draw day would already be past its closing time.
 */
export function nextThaiDrawDate(now: Date = new Date()): string {
  const clock = new Date(now.getTime() + MYANMAR_UTC_OFFSET_MINUTES * MINUTE_MS);
  const year = clock.getUTCFullYear();
  const month = clock.getUTCMonth();
  const day = clock.getUTCDate();
  if (day < 16) return `${year}-${pad(month + 1)}-16`;
  const next = new Date(Date.UTC(year, month + 1, 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;
}
