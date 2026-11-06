/**
 * Small helpers shared by the Draws pages, their columns and their dialogs:
 * badge tones, the field-lock rules, the status-action rules and the words
 * for a refused request.
 */
import type { StatusTone } from "@/components/shared/StatusBadge";
import type { TranslationShape } from "@/lib/i18n/translations";
import { ApiError } from "@/services/api/apiClient";
import {
  LOTTERY_LIMITS,
  LOTTERY_NUMBER_PATTERN,
  type LotteryAdminDraw,
  type LotteryDrawResults,
  type LotteryDrawStatus,
  type LotteryTicketStatus,
} from "@/types/lottery";

/** Open is the one state that takes money, so it alone reads green. */
export const DRAW_STATUS_TONES: Record<LotteryDrawStatus, StatusTone> = {
  scheduled: "neutral",
  open: "success",
  paused: "warning",
  closed: "neutral",
  published: "info",
};

export const TICKET_STATUS_TONES: Record<LotteryTicketStatus, StatusTone> = {
  waiting: "info",
  won: "success",
  notwon: "neutral",
};

/**
 * Why a draw field cannot be edited (the backend's PATCH rules): the date,
 * price and limit lock once a ticket is sold or the draw is published; the
 * picture and the frame lock once a ticket is sold (sold tickets keep the
 * look they were sold with); the closing time locks once sales are closed.
 * Null = editable.
 */
export type DrawLockReason = "sold" | "published" | "closed";

export interface DrawFieldLocks {
  thaiDrawDate: DrawLockReason | null;
  ticketPrice: DrawLockReason | null;
  maxPerNumber: DrawLockReason | null;
  pictureUrl: DrawLockReason | null;
  frameUrl: DrawLockReason | null;
  salesCloseAt: DrawLockReason | null;
}

export function drawFieldLocks(
  draw: Pick<LotteryAdminDraw, "status" | "ticketsSold">,
): DrawFieldLocks {
  const sold = draw.ticketsSold > 0;
  const published = draw.status === "published";
  const closed = draw.status === "closed" || published;
  // "sold" is named first: it is the reason that holds longest.
  const terms = sold ? "sold" : published ? "published" : null;
  return {
    thaiDrawDate: terms,
    ticketPrice: terms,
    maxPerNumber: terms,
    pictureUrl: sold ? "sold" : null,
    frameUrl: sold ? "sold" : null,
    salesCloseAt: closed ? "closed" : null,
  };
}

/** True once the closing time is behind `now` — sales cannot open, and the cron closes an open draw. */
export function isSalesCloseElapsed(
  draw: Pick<LotteryAdminDraw, "salesCloseAt">,
  now: number,
): boolean {
  return new Date(draw.salesCloseAt).getTime() <= now;
}

/** scheduled / paused → open, while the closing time is still ahead. */
export function canOpenDraw(
  draw: Pick<LotteryAdminDraw, "status" | "salesCloseAt">,
  now: number,
): boolean {
  return (
    (draw.status === "scheduled" || draw.status === "paused") &&
    !isSalesCloseElapsed(draw, now)
  );
}

export function canPauseDraw(draw: Pick<LotteryAdminDraw, "status">): boolean {
  return draw.status === "open";
}

export function canCloseDraw(draw: Pick<LotteryAdminDraw, "status">): boolean {
  return draw.status === "open" || draw.status === "paused";
}

/** Why a closed draw cannot reopen: its closing time has passed, or a results sheet is already in. */
export type ReopenBlockReason = "past" | "results";

/** A sheet counts as "in" once fetched (from the source or by hand) or published; pending / failed do not. */
export function hasResultsIn(
  results: Pick<LotteryDrawResults, "status"> | null,
): boolean {
  return (
    results !== null &&
    (results.status === "fetched" || results.status === "published")
  );
}

/**
 * The backend's reopen rules for a CLOSED draw (null = it may reopen). The
 * time check comes first: a draw the cron closed at its closing time is the
 * common case, and its sheet is usually in as well. `results` null = the
 * record has not loaded yet, which blocks nothing here — the button waits
 * for it separately.
 */
export function reopenBlockReason(
  draw: Pick<LotteryAdminDraw, "status" | "salesCloseAt">,
  now: number,
  results: Pick<LotteryDrawResults, "status"> | null,
): ReopenBlockReason | null {
  if (draw.status !== "closed") return null;
  if (isSalesCloseElapsed(draw, now)) return "past";
  if (hasResultsIn(results)) return "results";
  return null;
}

/** closed → open again, while the closing time is still ahead and no sheet is in (the cron closes it again at that time). */
export function canReopenDraw(
  draw: Pick<LotteryAdminDraw, "status" | "salesCloseAt">,
  now: number,
  results: Pick<LotteryDrawResults, "status"> | null,
): boolean {
  return (
    draw.status === "closed" && reopenBlockReason(draw, now, results) === null
  );
}

const PRICE_PATTERN = new RegExp(
  `^\\d+(?:\\.\\d{1,${LOTTERY_LIMITS.ticketPrice.decimals}})?$`,
);

/** A ticket price the backend accepts: 1 Ks or more, at most two decimals (Settings and the draw dialog share it). */
export function isTicketPrice(text: string): boolean {
  const trimmed = text.trim();
  return (
    PRICE_PATTERN.test(trimmed) &&
    Number(trimmed) >= LOTTERY_LIMITS.ticketPrice.min
  );
}

/** A rate like 75 or 75.25 — up to the backend's four decimals, no trailing zeros. */
export function formatRate(rate: number): string {
  return rate.toLocaleString("en-US", {
    maximumFractionDigits: LOTTERY_LIMITS.exchangeRateDecimals,
  });
}

/**
 * The numbers typed or pasted into the off-sale box: every run of digits is
 * one number, so "123456, 234567 345678" gives three. A run that is not six
 * digits is reported, not dropped, so a typo is seen.
 */
export function parseOffSaleInput(text: string): {
  numbers: string[];
  invalid: string[];
} {
  const numbers: string[] = [];
  const invalid: string[] = [];
  for (const token of text.split(/[^\d]+/).filter(Boolean)) {
    (LOTTERY_NUMBER_PATTERN.test(token) ? numbers : invalid).push(token);
  }
  return { numbers, invalid };
}

/** Same list, same order? The off-sale card's "unsaved changes" test. */
export function sameNumbers(
  a: readonly string[],
  b: readonly string[],
): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** The backend's "the draw is not in that state" refusal (409). */
export function isDrawStateError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === "LOTTERY_DRAW_STATE";
}

/** 404, or the 400 a draw ID that is not a UUID gets from the backend's ParseUUIDPipe — a mistyped link, not a failure. */
export function isDrawNotFound(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.status === 404 || err.status === 400);
}

/** The words for a refused request: the backend's own sentence, or the generic one. */
export function lotteryErrorMessage(err: unknown, t: TranslationShape): string {
  return err instanceof ApiError ? err.message : t.common.somethingWentWrong;
}
