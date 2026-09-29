import type { VerificationFilter } from "@/types/bank-verification";

/** DepositStatus and WithdrawalStatus share these three members. */
export type MoneyQueueStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CountAndAmount {
  count: number;
  /** Kyat, summed by the database. */
  amount: number;
}

/**
 * GET /deposits/stats and GET /withdrawals/stats (H-24): the queue's stat
 * cards and tab counts over EVERY row matching the list filters, not just the
 * page the browser loaded. Mirrors the backend's `AdminMoneyStats`.
 *
 * - `byStatus` / `total` respect the date range, search and the selected
 *   verification tab, but ignore the status tab.
 * - `verification` respects the date range, search and the status tab, but
 *   ignores the selected verification tab.
 */
export interface MoneyQueueStats {
  byStatus: Record<MoneyQueueStatus, CountAndAmount>;
  total: CountAndAmount;
  verification: Record<VerificationFilter, number>;
}
