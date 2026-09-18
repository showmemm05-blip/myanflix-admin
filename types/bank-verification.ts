/**
 * The BANK side of a deposit or withdrawal — orthogonal to the money state
 * (`DepositStatus` / `WithdrawalStatus`), which stays PENDING → APPROVED |
 * REJECTED exactly as before. Mirrors the backend's `BankMatchStatus` /
 * `BankRiskLevel` enums and the reason codes its risk rules emit.
 */

/** Stored on the row. UNVERIFIED until a bank notification is applied. */
export type BankMatchStatus = "UNVERIFIED" | "MATCHED" | "PENDING_REVIEW" | "SUSPICIOUS";

/**
 * What the badge shows. NO_BANK_TRANSACTION is never stored — it is computed
 * at read time (pending, never bank-checked, older than 24 h) so nothing has
 * to sweep the table to flip it.
 */
export type BankMatchStatusView = BankMatchStatus | "NO_BANK_TRANSACTION";

export type BankRiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** Every reason the matcher can attach; `t.verification.reasons` is indexed by these. */
export type BankRiskReason =
  | "AMOUNT_MISMATCH"
  | "CODE_MISMATCH"
  | "DUPLICATE_REFERENCE"
  | "SHARED_REFERENCE_ACROSS_USERS"
  | "TIME_GAP_TOO_LARGE"
  | "SUBMITTED_BEFORE_TRANSFER"
  | "VELOCITY"
  | "AMBIGUOUS_MATCH"
  | "NO_BANK_TRANSACTION"
  | "DUPLICATE_PAYOUT_CODE";

/** The server-side `verification` list filter — a combination of status × matchStatus. */
export type VerificationFilter = "all" | "awaiting_bank" | "verified" | "needs_review" | "no_bank_transaction";

export const VERIFICATION_FILTERS: VerificationFilter[] = [
  "all",
  "awaiting_bank",
  "verified",
  "needs_review",
  "no_bank_transaction",
];

/** `PATCH /deposits/:id/verification` actions (withdrawals mirror). */
export type VerificationReviewAction = "clear" | "confirm_suspicious" | "unlink";
