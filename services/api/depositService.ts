import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { Deposit, DepositStatus } from "@/types/deposit";
import { userLabelOr } from "@/lib/user-label";

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
  receivingAccountType: string | null;
  receivingAccountSubname: string | null;
  receivingAccountName: string | null;
  receivingAccountNumber: string | null;
  receivingTransactionCode: string | null;
  receivingTransactionTime: string | null;
  receivingPaymentAccountId: string | null;
  walletBalanceBefore: number | null;
  walletBalanceAfter: number | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; displayName: string | null; phone: string | null; email: string | null } | null;
}

function mapDeposit(d: BackendDeposit): Deposit {
  return {
    id: d.id,
    userId: d.userId,
    userName: userLabelOr(d.user, "Unknown user"),
    userUsername: d.user?.username ?? null,
    userPhone: d.user?.phone ?? null,
    userEmail: d.user?.email ?? null,
    amount: d.amount,
    paymentMethod: d.paymentMethod,
    accountName: d.accountName,
    reference: d.reference,
    status: d.status,
    rejectionReason: d.rejectionReason,
    approvedByUserId: d.approvedByUserId,
    approvedAt: d.approvedAt,
    receivingAccountType: d.receivingAccountType,
    receivingAccountSubname: d.receivingAccountSubname,
    receivingAccountName: d.receivingAccountName,
    receivingAccountNumber: d.receivingAccountNumber,
    receivingTransactionCode: d.receivingTransactionCode,
    receivingTransactionTime: d.receivingTransactionTime,
    receivingPaymentAccountId: d.receivingPaymentAccountId,
    walletBalanceBefore: d.walletBalanceBefore,
    walletBalanceAfter: d.walletBalanceAfter,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export interface DepositQuery extends PaginationParams {
  status?: DepositStatus;
  userId?: string;
  /** Full ISO datetime (inclusive lower bound on createdAt) — never a bare YYYY-MM-DD. */
  dateFrom?: string;
  /** Full ISO datetime (inclusive upper bound on createdAt) — never a bare YYYY-MM-DD. */
  dateTo?: string;
}

/** Payload for an admin-recorded deposit — mirrors the backend's CreateManualDepositDto. */
export interface CreateManualDepositValues {
  userId: string;
  amount: number;
  paymentMethod: string;
  /** The customer's own account name (what they sent FROM) — same semantics as user-submitted deposits. */
  accountName?: string;
  reference: string;
  /** The catalog PaymentAccount the money actually landed in — hidden accounts allowed. */
  destinationPaymentAccountId: string;
  /** Last 6 alphanumeric characters from the provider's confirmation. */
  receivingTransactionCode?: string;
  /** Time of day only ("HH:MM:SS") — the existing storage for transaction time. */
  receivingTransactionTime?: string;
}

export const depositService = {
  /** All deposits platform-wide — requires DEPOSIT_MANAGE (Admin/Super Admin). */
  async getAll(query: DepositQuery = {}): Promise<PaginatedResponse<Deposit>> {
    const res = await apiClient.get<PaginatedResponse<BackendDeposit>>("/deposits", { params: query });
    return { ...res, items: res.items.map(mapDeposit) };
  },

  /**
   * Records a deposit on the user's behalf — created already APPROVED, with the
   * wallet credited and the destination account's ledger updated in one go.
   * Requires DEPOSIT_MANAGE (Admin/Super Admin).
   */
  createManualDeposit(values: CreateManualDepositValues): Promise<Deposit> {
    return apiClient.post<BackendDeposit>("/deposits/manual", values).then(mapDeposit);
  },

  /** Auto-credits whichever payment account the depositor declared when submitting — no admin override needed. */
  approve(id: string): Promise<Deposit> {
    return apiClient.patch<BackendDeposit>(`/deposits/${id}/approve`).then(mapDeposit);
  },

  reject(id: string, reason: string): Promise<Deposit> {
    return apiClient.patch<BackendDeposit>(`/deposits/${id}/reject`, { reason }).then(mapDeposit);
  },

  /**
   * Records OUR account — the one we received the money INTO — separate from the
   * user's own deposit info. True PATCH semantics server-side: omitted fields
   * stay untouched, explicit `null` clears (subname, paymentAccountId), so
   * each caller sends ONLY what it manages — the free-text customer-FROM
   * record (UserDepositAccountCell) and the catalog account link
   * (ReceivingAccountCell) can never clobber each other.
   */
  updateReceivingAccount(
    id: string,
    values: {
      receivingAccountType?: string;
      /** Explicit `null` clears a stale catalog subname when the record is typed manually. */
      receivingAccountSubname?: string | null;
      receivingAccountName?: string;
      receivingAccountNumber?: string;
      receivingTransactionTime?: string;
      /** The catalog PaymentAccount this deposit's money landed in — send explicit `null` when cleared/hand-typed. */
      paymentAccountId?: string | null;
    },
  ): Promise<Deposit> {
    return apiClient
      .patch<BackendDeposit>(`/deposits/${id}/receiving-account`, values)
      .then(mapDeposit);
  },
};
