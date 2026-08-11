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
  status: WithdrawalStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  transferAccountType: string | null;
  transferAccountName: string | null;
  transferAccountNumber: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; email: string; phone: string | null } | null;
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
    status: w.status,
    rejectionReason: w.rejectionReason,
    approvedByUserId: w.approvedByUserId,
    approvedAt: w.approvedAt,
    transferAccountType: w.transferAccountType,
    transferAccountName: w.transferAccountName,
    transferAccountNumber: w.transferAccountNumber,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

export interface WithdrawalQuery extends PaginationParams {
  status?: WithdrawalStatus;
  userId?: string;
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
    values: { transferAccountType: string; transferAccountName: string; transferAccountNumber: string },
  ): Promise<Withdrawal> {
    return apiClient
      .patch<BackendWithdrawal>(`/withdrawals/${id}/transfer-account`, values)
      .then(mapWithdrawal);
  },
};
