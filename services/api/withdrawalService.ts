import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  BankMatchStatusView,
  BankRiskLevel,
  BankRiskReason,
  VerificationFilter,
  VerificationReviewAction,
} from "@/types/bank-verification";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";
import { userLabelOr } from "@/lib/user-label";

interface BackendWithdrawal {
  id: string;
  userId: string;
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
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
  // Bank-verification fields — only on the admin response (`toAdminResponse`);
  // optional here so a row from an older backend still maps to UNVERIFIED.
  transferAmount?: number | null;
  transferTransactionAt?: string | null;
  bankCheckedAt?: string | null;
  /** Already the VIEW value — the admin response applies any derivation server-side. */
  matchStatus?: BankMatchStatusView;
  riskLevel?: BankRiskLevel | null;
  riskReasons?: BankRiskReason[];
  hasBankScreenshot?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; displayName: string | null; phone: string | null; email: string | null } | null;
}

function mapWithdrawal(w: BackendWithdrawal): Withdrawal {
  return {
    id: w.id,
    userId: w.userId,
    userName: userLabelOr(w.user, "Unknown user"),
    userUsername: w.user?.username ?? null,
    userPhone: w.user?.phone ?? null,
    userEmail: w.user?.email ?? null,
    amount: w.amount,
    accountType: w.accountType,
    accountName: w.accountName,
    accountNumber: w.accountNumber,
    bankName: w.bankName,
    status: w.status,
    rejectionReason: w.rejectionReason,
    approvedByUserId: w.approvedByUserId,
    approvedAt: w.approvedAt,
    transferAccountType: w.transferAccountType,
    transferAccountSubname: w.transferAccountSubname,
    transferAccountName: w.transferAccountName,
    transferAccountNumber: w.transferAccountNumber,
    transferTransactionCode: w.transferTransactionCode,
    transferTransactionTime: w.transferTransactionTime,
    transferPaymentAccountId: w.transferPaymentAccountId,
    transferAmount: w.transferAmount ?? null,
    transferTransactionAt: w.transferTransactionAt ?? null,
    bankCheckedAt: w.bankCheckedAt ?? null,
    matchStatus: w.matchStatus ?? "UNVERIFIED",
    riskLevel: w.riskLevel ?? null,
    riskReasons: w.riskReasons ?? [],
    hasBankScreenshot: w.hasBankScreenshot ?? false,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

export interface WithdrawalQuery extends PaginationParams {
  status?: WithdrawalStatus;
  /** Bank-verification axis (status × matchStatus) — server-side, see VerificationFilterTabs. */
  verification?: VerificationFilter;
  userId?: string;
  /** Full ISO datetime (inclusive lower bound on createdAt) — never a bare YYYY-MM-DD. */
  dateFrom?: string;
  /** Full ISO datetime (inclusive upper bound on createdAt) — never a bare YYYY-MM-DD. */
  dateTo?: string;
}

export const withdrawalService = {
  /** All withdrawals platform-wide, pending first — requires WITHDRAWAL_MANAGE (Admin/Super Admin). */
  async getAll(query: WithdrawalQuery = {}): Promise<PaginatedResponse<Withdrawal>> {
    const res = await apiClient.get<PaginatedResponse<BackendWithdrawal>>("/withdrawals", {
      params: query,
    });
    return { ...res, items: res.items.map(mapWithdrawal) };
  },

  /** No body — the approve route takes none. A note for approving a flagged row goes through `reviewVerification` first. */
  approve(id: string): Promise<Withdrawal> {
    return apiClient.patch<BackendWithdrawal>(`/withdrawals/${id}/approve`).then(mapWithdrawal);
  },

  /** Staff review of the bank match (WITHDRAWALS.EDIT) — see depositService.reviewVerification. */
  reviewVerification(id: string, action: VerificationReviewAction, note?: string): Promise<Withdrawal> {
    const trimmed = note?.trim();
    return apiClient
      .patch<BackendWithdrawal>(`/withdrawals/${id}/verification`, trimmed ? { action, note: trimmed } : { action })
      .then(mapWithdrawal);
  },

  /** The matched payout notification's screenshot (WITHDRAWALS.BANK_EVIDENCE) — streamed, never a public URL. */
  fetchBankScreenshot(id: string): Promise<Blob> {
    return apiClient.getBlob(`/withdrawals/${id}/bank-screenshot`);
  },

  reject(id: string, reason: string): Promise<Withdrawal> {
    return apiClient.patch<BackendWithdrawal>(`/withdrawals/${id}/reject`, { reason }).then(mapWithdrawal);
  },

  /** Records OUR account — the one we sent the money FROM — separate from the user's own withdrawal account. */
  updateTransferAccount(
    id: string,
    values: {
      transferAccountType: string;
      transferAccountSubname?: string;
      transferAccountName: string;
      transferAccountNumber: string;
      transferTransactionCode: string;
      transferTransactionTime: string;
      /** The catalog PaymentAccount this withdrawal's money went out of — send explicit `null` when cleared/hand-typed. */
      paymentAccountId?: string | null;
    },
  ): Promise<Withdrawal> {
    return apiClient
      .patch<BackendWithdrawal>(`/withdrawals/${id}/transfer-account`, values)
      .then(mapWithdrawal);
  },
};
