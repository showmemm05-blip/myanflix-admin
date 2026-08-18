import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";

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
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; phone: string | null } | null;
}

function mapWithdrawal(w: BackendWithdrawal): Withdrawal {
  return {
    id: w.id,
    userId: w.userId,
    userName: w.user?.username ?? "Unknown user",
    userPhone: w.user?.phone ?? null,
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
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

export interface WithdrawalQuery extends PaginationParams {
  status?: WithdrawalStatus;
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

  approve(id: string): Promise<Withdrawal> {
    return apiClient.patch<BackendWithdrawal>(`/withdrawals/${id}/approve`).then(mapWithdrawal);
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
