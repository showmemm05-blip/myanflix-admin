import type { BankMatchStatusView, BankRiskLevel, BankRiskReason } from "@/types/bank-verification";

export type DepositStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Deposit {
  id: string;
  userId: string;
  /** The resolved label to render — `userLabel()` output, never the raw identity. */
  userName: string;
  /**
   * The customer's raw login identity, carried alongside the label so a
   * self-chosen display name can never hide which account a row belongs to —
   * it is what the detail dialogs print as `@username` and what the queue
   * search still matches on. Null when the user relation wasn't joined.
   */
  userUsername: string | null;
  userPhone: string | null;
  /** Shown in place of the phone for accounts without one (e.g. Google sign-ins). */
  userEmail: string | null;
  amount: number;
  paymentMethod: string;
  accountName: string | null;
  reference: string;
  status: DepositStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  /** The account WE received the money into — recorded manually by an admin after approval. */
  receivingAccountType: string | null;
  /** Copied from the picked PaymentAccount's subname (e.g. "K1") — null if typed in manually. */
  receivingAccountSubname: string | null;
  receivingAccountName: string | null;
  receivingAccountNumber: string | null;
  /** Last 6 characters only, keyed in by the admin from the provider's confirmation. */
  receivingTransactionCode: string | null;
  /** Time of day only (no date), e.g. "06:56:28". */
  receivingTransactionTime: string | null;
  /** The catalog PaymentAccount this deposit's money landed in — null if the receiving account was hand-typed instead of picked. Drives the DEPOSIT_IN ledger entry. */
  receivingPaymentAccountId: string | null;
  /** Customer wallet balance immediately before/after this deposit's credit — captured at approve/manual-create time; null for deposits credited before snapshots existed and for PENDING/REJECTED deposits. */
  walletBalanceBefore: number | null;
  walletBalanceAfter: number | null;
  /** Which of OUR accounts the depositor said they sent to — the matcher only ever matches on this account. Null for older clients. */
  declaredPaymentAccountId: string | null;
  /**
   * What the BANK said, written by the matcher only — never by an admin form.
   * Null until the phone-monitor's "You received …" event is applied.
   */
  receivingAmount: number | null;
  /** Full timestamp of the bank notification (the old `receivingTransactionTime` stays time-of-day only). */
  receivingTransactionAt: string | null;
  /** Set once, when a bank event was applied — null means the row is still waiting for its notification. */
  bankCheckedAt: string | null;
  /** The VIEW value: the admin response already applies the read-time NO_BANK_TRANSACTION derivation. */
  matchStatus: BankMatchStatusView;
  riskLevel: BankRiskLevel | null;
  /** Stored reasons plus the server's read-time derivations (NO_BANK_TRANSACTION). */
  riskReasons: BankRiskReason[];
  /** The screenshot itself is never in JSON — it streams through the BANK_EVIDENCE route. */
  hasBankScreenshot: boolean;
  /** When the user says they transferred — the mobile form does not send it yet, so usually null. */
  declaredTransferAt: string | null;
  createdAt: string;
  updatedAt: string;
}
