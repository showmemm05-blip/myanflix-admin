/**
 * Helpers shared by the Prize claims page, its dialogs and the draw page's
 * Claim column (2026-10-24): the status tones and icons, the money strings
 * of the claims wire, the words for a draw and the backend's refusals.
 */
import type { LucideIcon } from "lucide-react";
import { CircleCheck, CircleMinus, CircleX, Clock, Lock } from "lucide-react";
import type { StatusTone } from "@/components/shared/StatusBadge";
import { formatKs } from "@/components/lottery/resultsFormat";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatDateOnly } from "@/lib/myanmar-time";
import { ApiError } from "@/services/api/apiClient";
import {
  LOTTERY_CLAIM_LIST_STATUSES,
  type LotteryAdminClaim,
  type LotteryClaimListStatus,
  type LotteryWinnerClaimStatus,
} from "@/types/lottery";

/** Waiting is the one state that asks for a decision, so it alone reads amber; paid is the only green. */
export const CLAIM_STATUS_TONES: Record<LotteryWinnerClaimStatus, StatusTone> = {
  not_requested: "neutral",
  requested: "warning",
  paid: "success",
  rejected: "danger",
  expired: "neutral",
};

/** The chip carries an icon beside the word, so colour is never the only carrier (the board's rule). */
export const CLAIM_STATUS_ICONS: Record<LotteryWinnerClaimStatus, LucideIcon> = {
  not_requested: CircleMinus,
  requested: Clock,
  paid: CircleCheck,
  rejected: CircleX,
  expired: Lock,
};

/** The claims wire sends money as "6000.00" strings, the draw view as numbers: both read as a number here (unreadable → 0). */
export function moneyNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** "150,000 Ks" from either wire shape. */
export function formatMoney(value: string | number | null | undefined): string {
  return formatKs(moneyNumber(value));
}

/** "Draw 2 · 17 Oct 2026" — how the claims page names a draw. */
export function claimDrawLabel(
  t: TranslationShape,
  claim: Pick<LotteryAdminClaim, "drawNo" | "thaiDrawDate">,
): string {
  return t.lottery.claims.drawLabel(claim.drawNo, formatDateOnly(claim.thaiDrawDate));
}

/** A `?status=` query value as a tab, or null for anything else. */
export function toClaimListStatus(value: string | null | undefined): LotteryClaimListStatus | null {
  return value && (LOTTERY_CLAIM_LIST_STATUSES as readonly string[]).includes(value)
    ? (value as LotteryClaimListStatus)
    : null;
}

/**
 * 409: the claim is no longer in the state this page showed — decided by
 * someone else meanwhile (LOTTERY_CLAIM_STATE), or its payouts no longer add
 * up to it (LOTTERY_CLAIM_TOTAL_MISMATCH, which the backend never pays).
 */
export function isClaimStateError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 409;
}

/** 404, or the 400 an id that is not a UUID gets from the backend's pipe — a stale link, not a failure. */
export function isClaimNotFound(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.status === 404 || err.status === 400);
}
