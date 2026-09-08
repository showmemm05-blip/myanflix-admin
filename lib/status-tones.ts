import type { StatusTone } from "@/components/shared/StatusBadge";
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
