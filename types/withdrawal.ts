export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Withdrawal {
  id: string;
  userId: string;
  /** The resolved label to render — `userLabel()` output, never the raw identity. */
  userName: string;
  /**
   * The customer's raw login identity, carried alongside the label so a
   * self-chosen display name can never hide which account a payout belongs to
   * — printed as `@username` in the detail dialog and matched by the queue
   * search. Null when the user relation wasn't joined.
   */
  userUsername: string | null;
  userPhone: string | null;
  /** Shown in place of the phone for accounts without one (e.g. Google sign-ins). */
  userEmail: string | null;
  amount: number;
  /** The account the user provided to receive the money — never edited by admins. */
  accountType: string;
  accountName: string;
  accountNumber: string;
  /** The bank named on THIS request — null for non-bank methods and for requests made before we captured it. */
  bankName: string | null;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  /** The account WE sent the money from — recorded manually by an admin after approval. */
  transferAccountType: string | null;
  /** Copied from the picked PaymentAccount's subname (e.g. "K1") — null if typed in manually. */
  transferAccountSubname: string | null;
  transferAccountName: string | null;
  transferAccountNumber: string | null;
  /** Last 6 digits only, keyed in by the admin from the provider's confirmation. */
  transferTransactionCode: string | null;
  /** The actual time the transfer happened, per the provider's receipt. */
  transferTransactionTime: string | null;
  /** The catalog PaymentAccount this withdrawal's money went out of — null if the transfer account was hand-typed instead of picked. Drives the WITHDRAWAL_OUT ledger entry. */
  transferPaymentAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}
