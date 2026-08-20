import type { DepositStatus } from "@/types/deposit";
import type { WithdrawalStatus } from "@/types/withdrawal";

export type PaymentAccountTransactionType =
  | "OPENING_BALANCE"
  | "MANUAL_CREDIT"
  | "MANUAL_DEBIT"
  | "DEPOSIT_IN"
  | "WITHDRAWAL_OUT"
  | "ADJUSTMENT_CREDIT"
  | "ADJUSTMENT_DEBIT";

/** DEPOSIT_IN/WITHDRAWAL_OUT are system-generated only (via deposit/withdrawal approval) — excluded from the manual Add/Remove Money dialog. */
export const MANUAL_PAYMENT_ACCOUNT_TRANSACTION_TYPES = [
  "OPENING_BALANCE",
  "MANUAL_CREDIT",
  "MANUAL_DEBIT",
  "ADJUSTMENT_CREDIT",
  "ADJUSTMENT_DEBIT",
] as const;

export const CREDIT_TRANSACTION_TYPES: PaymentAccountTransactionType[] = [
  "OPENING_BALANCE",
  "MANUAL_CREDIT",
  "DEPOSIT_IN",
  "ADJUSTMENT_CREDIT",
];

export interface PaymentAccountTransactionStaffRef {
  id: string;
  /** Login identity. Render `userLabel()` instead — never this raw. */
  username: string;
  displayName: string | null;
}

export interface PaymentAccountTransactionAccountRef {
  id: string;
  type: string;
  subname: string | null;
  accountName: string;
}

/** The row's own account — richer than the plain refs nested inside a deposit/withdrawal. */
export interface PaymentAccountTransactionAccount extends PaymentAccountTransactionAccountRef {
  accountNumber: string;
  bankName: string | null;
  note: string | null;
  isActive: boolean;
}

export interface PaymentAccountTransactionPerformer extends PaymentAccountTransactionStaffRef {
  role: string;
}

/**
 * The customer on the other side of a linked deposit/withdrawal. Phone signups
 * carry a machine-generated username, so the name to show is `displayName`
 * (via `userLabel()`) — `phone` stays the identity anchor when they never set
 * one, and the rest tells an admin whether the account is in good standing.
 */
export interface PaymentAccountTransactionCustomer extends PaymentAccountTransactionStaffRef {
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  /** Null when the user has no wallet row yet — distinct from a zero balance. */
  walletBalance: number | null;
}

/**
 * The deposit that produced a DEPOSIT_IN (or its ADJUSTMENT_DEBIT reversal),
 * joined in full so the details panel can explain where the money came from.
 */
export interface RelatedDepositDetail {
  id: string;
  userId: string;
  amount: number;
  /** What the depositor says they paid with — free text, not the catalog. */
  paymentMethod: string;
  accountName: string | null;
  reference: string;
  status: DepositStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  receivingAccountType: string | null;
  receivingAccountSubname: string | null;
  receivingAccountName: string | null;
  receivingAccountNumber: string | null;
  receivingTransactionCode: string | null;
  receivingTransactionTime: string | null;
  receivingPaymentAccountId: string | null;
  /** Customer wallet balance immediately before/after this deposit's credit — null for deposits credited before snapshots existed and for PENDING/REJECTED deposits. */
  walletBalanceBefore: number | null;
  walletBalanceAfter: number | null;
  createdAt: string;
  updatedAt: string;
  user: PaymentAccountTransactionCustomer;
  approvedBy: PaymentAccountTransactionStaffRef | null;
  receivingPaymentAccount: PaymentAccountTransactionAccountRef | null;
}

/** The withdrawal that produced a WITHDRAWAL_OUT (or its ADJUSTMENT_CREDIT reversal). */
export interface RelatedWithdrawalDetail {
  id: string;
  userId: string;
  amount: number;
  /** The user's own destination account — never one of ours. */
  accountType: string;
  accountName: string;
  accountNumber: string;
  /** The bank named on THIS request — null for non-bank methods and for requests made before we captured it. */
  bankName: string | null;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  transferAccountType: string | null;
  transferAccountSubname: string | null;
  transferAccountName: string | null;
  transferAccountNumber: string | null;
  transferTransactionCode: string | null;
  transferTransactionTime: string | null;
  transferPaymentAccountId: string | null;
  createdAt: string;
  updatedAt: string;
  user: PaymentAccountTransactionCustomer;
  approvedBy: PaymentAccountTransactionStaffRef | null;
  transferPaymentAccount: PaymentAccountTransactionAccountRef | null;
}

/** Shape returned by GET .../transactions (per-account history + central cross-account view). */
export interface PaymentAccountTransaction {
  id: string;
  paymentAccountId: string;
  paymentAccount: PaymentAccountTransactionAccount;
  type: PaymentAccountTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceCode: string | null;
  note: string | null;
  relatedDepositId: string | null;
  relatedWithdrawalId: string | null;
  performedByUserId: string | null;
  performedBy: PaymentAccountTransactionPerformer | null;
  createdAt: string;
  /** Populated only for entries generated by a deposit link/approval. */
  relatedDeposit: RelatedDepositDetail | null;
  /** Populated only for entries generated by a withdrawal transfer link. */
  relatedWithdrawal: RelatedWithdrawalDetail | null;
}

/** Shape returned by POST .../transactions's `entry` field — lighter than the list shape (no joined relations). */
export interface PaymentAccountTransactionEntry {
  id: string;
  paymentAccountId: string;
  type: PaymentAccountTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceCode: string | null;
  note: string | null;
  relatedDepositId: string | null;
  relatedWithdrawalId: string | null;
  performedByUserId: string | null;
  createdAt: string;
}

export interface RecordPaymentAccountTransactionValues {
  type: (typeof MANUAL_PAYMENT_ACCOUNT_TRANSACTION_TYPES)[number];
  amount: number;
  referenceCode?: string;
  note?: string;
}
