import type { BankMatchStatusView, BankRiskLevel, BankRiskReason } from "@/types/bank-verification";
import type { Deposit } from "@/types/deposit";
import type { Withdrawal } from "@/types/withdrawal";
import { userLabel } from "@/lib/user-label";

/**
 * The `deposit.created` / `withdrawal.created` socket payloads (admins room)
 * and the one place that turns them into table rows. Three surfaces prepend
 * a freshly created row — the deposits page, the withdrawals page and the
 * admin bell — and each used to spell out every null by hand, so a new
 * column meant three edits and a silent drift risk. Now the shape lives here.
 */

export interface DepositCreatedEvent {
  id: string;
  userId: string;
  /** Raw login identity, straight off the realtime payload. */
  username: string;
  /** The name the user set; null until they set one. Render via `userLabel(event)`. */
  displayName: string | null;
  phone: string | null;
  email: string | null;
  amount: number;
  paymentMethod: string;
  accountName: string | null;
  reference: string;
  status: Deposit["status"];
  createdAt: string;
  declaredPaymentAccountId?: string | null;
  /**
   * Pre-bank flags computed at create time (duplicate reference, velocity…).
   * Optional so a payload from before the verification feature still maps.
   */
  matchStatus?: BankMatchStatusView;
  riskLevel?: BankRiskLevel | null;
  riskReasons?: BankRiskReason[];
}

export interface WithdrawalCreatedEvent {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  /** Only sent for bank-transfer account types. */
  bankName: string | null;
  status: Withdrawal["status"];
  createdAt: string;
}

export function depositFromCreatedEvent(event: DepositCreatedEvent): Deposit {
  return {
    id: event.id,
    userId: event.userId,
    userName: userLabel(event),
    userUsername: event.username,
    userPhone: event.phone ?? null,
    userEmail: event.email ?? null,
    amount: event.amount,
    paymentMethod: event.paymentMethod,
    accountName: event.accountName,
    reference: event.reference,
    status: event.status,
    rejectionReason: null,
    approvedByUserId: null,
    approvedAt: null,
    receivingAccountType: null,
    receivingAccountSubname: null,
    receivingAccountName: null,
    receivingAccountNumber: null,
    receivingTransactionCode: null,
    receivingTransactionTime: null,
    receivingPaymentAccountId: null,
    walletBalanceBefore: null,
    walletBalanceAfter: null,
    declaredPaymentAccountId: event.declaredPaymentAccountId ?? null,
    // A brand-new row has no bank side yet; only the create-time flags exist.
    receivingAmount: null,
    receivingTransactionAt: null,
    bankCheckedAt: null,
    matchStatus: event.matchStatus ?? "UNVERIFIED",
    riskLevel: event.riskLevel ?? null,
    riskReasons: event.riskReasons ?? [],
    hasBankScreenshot: false,
    declaredTransferAt: null,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
  };
}

export function withdrawalFromCreatedEvent(event: WithdrawalCreatedEvent): Withdrawal {
  return {
    id: event.id,
    userId: event.userId,
    userName: userLabel(event),
    userUsername: event.username,
    userPhone: event.phone ?? null,
    userEmail: event.email ?? null,
    amount: event.amount,
    accountType: event.accountType,
    accountName: event.accountName,
    accountNumber: event.accountNumber,
    bankName: event.bankName,
    status: event.status,
    rejectionReason: null,
    approvedByUserId: null,
    approvedAt: null,
    transferAccountType: null,
    transferAccountSubname: null,
    transferAccountName: null,
    transferAccountNumber: null,
    transferTransactionCode: null,
    transferTransactionTime: null,
    transferPaymentAccountId: null,
    // A payout is only matched after approval; nothing bank-side at creation.
    transferAmount: null,
    transferTransactionAt: null,
    bankCheckedAt: null,
    matchStatus: "UNVERIFIED",
    riskLevel: null,
    riskReasons: [],
    hasBankScreenshot: false,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
  };
}

/**
 * `deposit.verification` / `withdrawal.verification` — admins-only pushes
 * from the matcher and from staff review actions. Merged by id into the
 * loaded list so the badges (and an open modal) update without a refetch.
 */
export interface DepositVerificationEvent {
  id: string;
  matchStatus: BankMatchStatusView;
  riskLevel: BankRiskLevel | null;
  riskReasons: BankRiskReason[];
  receivingAmount: number | null;
  receivingTransactionCode: string | null;
  receivingTransactionAt: string | null;
  bankCheckedAt: string | null;
  hasBankScreenshot: boolean;
}

export interface WithdrawalVerificationEvent {
  id: string;
  matchStatus: BankMatchStatusView;
  riskLevel: BankRiskLevel | null;
  riskReasons: BankRiskReason[];
  transferAmount: number | null;
  transferTransactionCode: string | null;
  transferTransactionAt: string | null;
  bankCheckedAt: string | null;
  hasBankScreenshot: boolean;
}

export function mergeDepositVerification(d: Deposit, event: DepositVerificationEvent): Deposit {
  return {
    ...d,
    matchStatus: event.matchStatus,
    riskLevel: event.riskLevel ?? null,
    riskReasons: event.riskReasons ?? [],
    receivingAmount: event.receivingAmount ?? null,
    receivingTransactionCode: event.receivingTransactionCode ?? null,
    receivingTransactionAt: event.receivingTransactionAt ?? null,
    bankCheckedAt: event.bankCheckedAt ?? null,
    hasBankScreenshot: event.hasBankScreenshot ?? false,
  };
}

export function mergeWithdrawalVerification(w: Withdrawal, event: WithdrawalVerificationEvent): Withdrawal {
  return {
    ...w,
    matchStatus: event.matchStatus,
    riskLevel: event.riskLevel ?? null,
    riskReasons: event.riskReasons ?? [],
    transferAmount: event.transferAmount ?? null,
    transferTransactionCode: event.transferTransactionCode ?? null,
    transferTransactionAt: event.transferTransactionAt ?? null,
    bankCheckedAt: event.bankCheckedAt ?? null,
    hasBankScreenshot: event.hasBankScreenshot ?? false,
  };
}
