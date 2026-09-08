import { format } from "date-fns";

/**
 * Shared date/time helpers for the deposit + withdrawal transaction-time
 * pickers (UserDepositAccountCell, TransferAccountCell, ManualDepositDialog).
 * Hoisted verbatim — the three surfaces must render and normalise identically.
 */

export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:MM:SS" in local time, the value a `datetime-local` input expects. */
export function toDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Only the time-of-day (`transferTransactionTime` / `receivingTransactionTime`,
 * e.g. "06:56:28") is actually persisted today — the backend has no date
 * column yet. Date and time are
 * kept as two separate native inputs (rather than one `datetime-local`)
 * specifically so the date can be pre-filled while the time is left
 * genuinely blank — a single `datetime-local` input's value is all-or-
 * nothing, so there's no way to default just one half of it.
 */
export function initialDateValue(savedTime: string | null, approvedAt: string | null) {
  // Nothing saved yet — default to today so the admin isn't forced to type
  // it every time; they can still change it.
  if (!savedTime) return toDateTimeLocalValue(new Date()).slice(0, 10);
  // Already saved — pair it with the record's approval date (the best
  // available proxy for "when this probably happened"), exactly as before.
  const day = approvedAt ? new Date(approvedAt) : new Date();
  return toDateTimeLocalValue(day).slice(0, 10);
}

/** Blank until the admin fills it in (or uses "Now") — unchanged from before. */
export function initialTimeValue(savedTime: string | null) {
  return savedTime ?? "";
}

export function normalizeTime(time: string) {
  const [h = "00", m = "00", s = "00"] = time.split(":");
  return `${pad(Number(h))}:${pad(Number(m))}:${pad(Number(s))}`;
}

export function formatSavedDisplay(savedTime: string | null, approvedAt: string | null) {
  if (!savedTime) return null;
  const datePart = approvedAt ? format(new Date(approvedAt), "d MMM yyyy") : null;
  return datePart ? `${datePart}, ${savedTime}` : savedTime;
}

/** Live "12 Aug 2026, 06:56:28"-style preview of whatever the pickers currently hold. */
export function previewDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${format(parsed, "d MMM yyyy")}, ${normalizeTime(time)}`;
}
