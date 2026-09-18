import type {
  BankMatchStatusView,
  BankRiskLevel,
  BankRiskReason,
  VerificationFilter,
} from "@/types/bank-verification";
import type { Deposit } from "@/types/deposit";
import type { Withdrawal } from "@/types/withdrawal";

/**
 * Everything the verification UI (badges, filter counts, the details modal)
 * needs, in ONE shape for both deposits and withdrawals — so the modal is
 * written once and never branches on row type beyond the labels.
 *
 * "Submitted" is what the user (or the approving admin, for a payout)
 * claimed; "bank" is what the phone-monitor saw in the bank's notification.
 */
export interface VerificationRecord {
  kind: "deposit" | "withdrawal";
  id: string;
  userId: string;
  userName: string;
  userUsername: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  /** Submitted side. */
  amount: number;
  /** The user's own last-6 — deposits only; a withdrawal has no user-typed code. */
  reference: string | null;
  submittedAt: string;
  /** Withdrawals: when staff approved the payout — the bank time is compared against this. */
  approvedAt: string | null;
  /** The user's stated transfer time, when the client sent one (deposits only, usually null). */
  declaredTransferAt: string | null;
  /** Our payment account the movement was declared on / went out of. */
  paymentAccountId: string | null;
  /** Bank side. */
  bankAmount: number | null;
  /** Last 6 of the bank's transaction code, exactly as the bank printed it. */
  bankCode: string | null;
  bankAt: string | null;
  bankCheckedAt: string | null;
  /** As the server sent it — already the view value when it derived NO_BANK_TRANSACTION. */
  matchStatus: BankMatchStatusView;
  riskLevel: BankRiskLevel | null;
  riskReasons: BankRiskReason[];
  hasBankScreenshot: boolean;
}

/**
 * Mirrors the backend's NO_BANK_TRANSACTION_AFTER_MS: a pending deposit the
 * bank has not confirmed within a day is called out. Derived here too (not
 * only server-side) so a row that crossed the line since the last fetch, or
 * one prepended from a socket event, renders the same as a freshly loaded one.
 */
export const NO_BANK_TRANSACTION_AFTER_MS = 24 * 3_600_000;

export function toDepositVerification(d: Deposit): VerificationRecord {
  return {
    kind: "deposit",
    id: d.id,
    userId: d.userId,
    userName: d.userName,
    userUsername: d.userUsername,
    status: d.status,
    amount: d.amount,
    reference: d.reference,
    submittedAt: d.createdAt,
    approvedAt: d.approvedAt,
    declaredTransferAt: d.declaredTransferAt,
    paymentAccountId: d.declaredPaymentAccountId,
    bankAmount: d.receivingAmount,
    bankCode: d.receivingTransactionCode,
    bankAt: d.receivingTransactionAt,
    bankCheckedAt: d.bankCheckedAt,
    matchStatus: d.matchStatus,
    riskLevel: d.riskLevel,
    riskReasons: d.riskReasons,
    hasBankScreenshot: d.hasBankScreenshot,
  };
}

export function toWithdrawalVerification(w: Withdrawal): VerificationRecord {
  return {
    kind: "withdrawal",
    id: w.id,
    userId: w.userId,
    userName: w.userName,
    userUsername: w.userUsername,
    status: w.status,
    amount: w.amount,
    reference: null,
    submittedAt: w.createdAt,
    approvedAt: w.approvedAt,
    declaredTransferAt: null,
    paymentAccountId: w.transferPaymentAccountId,
    bankAmount: w.transferAmount,
    bankCode: w.transferTransactionCode,
    bankAt: w.transferTransactionAt,
    bankCheckedAt: w.bankCheckedAt,
    matchStatus: w.matchStatus,
    riskLevel: w.riskLevel,
    riskReasons: w.riskReasons,
    hasBankScreenshot: w.hasBankScreenshot,
  };
}

/**
 * Is this row still in the "open set" the matcher searches? Deposits: PENDING
 * and never bank-checked. Withdrawals: APPROVED, never bank-checked and no
 * payout code keyed in by hand — the same predicate as the backend's partial
 * index, so the "awaiting bank" tab count here agrees with the server filter.
 */
export function isAwaitingBank(r: VerificationRecord): boolean {
  if (r.bankCheckedAt) return false;
  if (r.kind === "deposit") return r.status === "PENDING";
  return r.status === "APPROVED" && r.bankCode === null;
}

/**
 * The read-time "no bank transaction" rule: still open, and older than the
 * window. Deposits age from submission; withdrawals from approval (the payout
 * cannot have happened before staff approved it).
 */
export function isNoBankTransaction(r: VerificationRecord, now = Date.now()): boolean {
  if (!isAwaitingBank(r)) return false;
  const since = r.kind === "deposit" ? r.submittedAt : (r.approvedAt ?? r.submittedAt);
  return now - new Date(since).getTime() > NO_BANK_TRANSACTION_AFTER_MS;
}

/** What the badge shows — the stored enum, or the derived no-bank state on top of it. */
export function viewMatchStatus(r: VerificationRecord, now = Date.now()): BankMatchStatusView {
  if (r.riskReasons.includes("NO_BANK_TRANSACTION") || isNoBankTransaction(r, now)) {
    return "NO_BANK_TRANSACTION";
  }
  return r.matchStatus;
}

/**
 * Reasons to list: stored ∪ derived, deduplicated. The server already unions
 * NO_BANK_TRANSACTION in; this only adds it for rows that crossed the 24 h
 * line client-side since they were fetched.
 */
export function viewRiskReasons(r: VerificationRecord, now = Date.now()): BankRiskReason[] {
  if (isNoBankTransaction(r, now) && !r.riskReasons.includes("NO_BANK_TRANSACTION")) {
    return [...r.riskReasons, "NO_BANK_TRANSACTION"];
  }
  return r.riskReasons;
}

const RISK_RANK: Record<BankRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Same lift as the backend: a derived no-bank row is at least MEDIUM. */
export function viewRiskLevel(r: VerificationRecord, now = Date.now()): BankRiskLevel | null {
  if (!isNoBankTransaction(r, now)) return r.riskLevel;
  if (r.riskLevel === null || RISK_RANK[r.riskLevel] < RISK_RANK.MEDIUM) return "MEDIUM";
  return r.riskLevel;
}

/**
 * Client-side twin of the server's five `verification` predicates — used only
 * to put counts on the tabs from the loaded page, never to filter what the
 * server already filtered.
 */
export function matchesVerificationFilter(
  r: VerificationRecord,
  filter: VerificationFilter,
  now = Date.now(),
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "verified":
      return r.matchStatus === "MATCHED";
    case "needs_review":
      return r.matchStatus === "PENDING_REVIEW" || r.matchStatus === "SUSPICIOUS";
    case "no_bank_transaction":
      return isNoBankTransaction(r, now);
    case "awaiting_bank":
      return isAwaitingBank(r) && !isNoBankTransaction(r, now);
  }
}

/**
 * Signed gap between what the user claimed and what the bank saw, in ms:
 * positive when the submission came AFTER the bank time (the honest order),
 * negative when the submission predates the transfer. Null until both sides
 * exist. Deposits compare submission (or the user's stated transfer time);
 * withdrawals compare approval time against the payout time.
 */
export function timeGapMs(r: VerificationRecord): number | null {
  if (!r.bankAt) return null;
  const ours = r.kind === "deposit" ? (r.declaredTransferAt ?? r.submittedAt) : (r.approvedAt ?? r.submittedAt);
  return new Date(ours).getTime() - new Date(r.bankAt).getTime();
}

/** "3h 12m 05s" — compact, unsigned; the caller adds direction words. */
export function formatDurationMs(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
