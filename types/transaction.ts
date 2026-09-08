/** Mirrors the backend's `TransactionType` Prisma enum — keep in sync. */
export type TransactionType =
  | "DEPOSIT"
  | "PURCHASE"
  | "REFUND"
  | "SUBSCRIPTION"
  | "WITHDRAWAL"
  /** Admin-initiated wallet correction (see WalletAdjustment). */
  | "ADJUSTMENT_CREDIT"
  | "ADJUSTMENT_DEBIT";

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface Transaction {
  id: string;
  userId: string;
  /** The resolved label to render — `userLabel()` output, never the raw identity. */
  userName: string;
  /**
   * The account's raw login identity, kept next to the label so the ledger
   * stays searchable by login identity when a display name is set. Null when
   * the user relation wasn't joined.
   */
  userUsername: string | null;
  movieId: string | null;
  movieTitle: string | null;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
}
