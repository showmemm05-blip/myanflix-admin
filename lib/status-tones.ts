import type { StatusTone } from "@/components/shared/StatusBadge";
import type { BankMatchStatusView, BankRiskLevel } from "@/types/bank-verification";
import type { UserStatus } from "@/types/user";

/**
 * Badge tones shared by every surface that renders a status pill, so a
 * deposit, withdrawal or account row can never drift to a different colour
 * for the same state.
 */

/** Deposits and withdrawals both move PENDING -> APPROVED | REJECTED. */
export const REVIEW_STATUS_TONE: Record<"PENDING" | "APPROVED" | "REJECTED", StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export const USER_STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

/**
 * The bank side of a deposit/withdrawal. Neutral while nothing has been
 * checked yet; danger for both a hard mismatch AND a row the bank never saw
 * — both mean "do not credit on faith".
 */
export const BANK_MATCH_TONE: Record<BankMatchStatusView, StatusTone> = {
  UNVERIFIED: "neutral",
  MATCHED: "success",
  PENDING_REVIEW: "warning",
  SUSPICIOUS: "danger",
  NO_BANK_TRANSACTION: "danger",
};

export const RISK_TONE: Record<BankRiskLevel, StatusTone> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
};
