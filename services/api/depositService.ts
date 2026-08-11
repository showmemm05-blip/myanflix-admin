import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { Deposit, DepositStatus } from "@/types/deposit";

interface BackendDeposit {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  accountName: string | null;
  reference: string;
  status: DepositStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; email: string; phone: string | null } | null;
}

function mapDeposit(d: BackendDeposit): Deposit {
  return {
    id: d.id,
    userId: d.userId,
    userName: d.user?.username ?? "Unknown user",
    userPhone: d.user?.phone ?? null,
    amount: d.amount,
    paymentMethod: d.paymentMethod,
    accountName: d.accountName,
    reference: d.reference,
    status: d.status,
    rejectionReason: d.rejectionReason,
    approvedByUserId: d.approvedByUserId,
    approvedAt: d.approvedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export interface DepositQuery extends PaginationParams {
  status?: DepositStatus;
  userId?: string;
}

export const depositService = {
  /** All deposits platform-wide — requires DEPOSIT_MANAGE (Admin/Super Admin). */
  async getAll(query: DepositQuery = {}): Promise<PaginatedResponse<Deposit>> {
    const res = await apiClient.get<PaginatedResponse<BackendDeposit>>("/deposits", { params: query });
    return { ...res, items: res.items.map(mapDeposit) };
  },

  approve(id: string): Promise<Deposit> {
    return apiClient.patch<BackendDeposit>(`/deposits/${id}/approve`).then(mapDeposit);
  },

  reject(id: string, reason: string): Promise<Deposit> {
    return apiClient.patch<BackendDeposit>(`/deposits/${id}/reject`, { reason }).then(mapDeposit);
  },
};
