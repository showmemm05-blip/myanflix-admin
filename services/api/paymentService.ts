import { apiClient } from "./apiClient";
import { tokenStore } from "@/lib/auth/token-store";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { FinanceSummary, RevenuePoint } from "@/types/analytics";
import type { Transaction, TransactionStatus, TransactionType } from "@/types/transaction";

function avatarFor(username: string) {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(username)}`;
}

interface BackendTransactionSelf {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  movieId: string | null;
  movieTitle: string | null;
  createdAt: string;
}

interface BackendTransactionAdmin extends BackendTransactionSelf {
  user: { id: string; username: string; email: string } | null;
}

function mapSelfTransaction(t: BackendTransactionSelf, selfUsername: string): Transaction {
  return {
    id: t.id,
    userId: t.userId,
    userName: selfUsername,
    userAvatarUrl: avatarFor(selfUsername),
    movieId: t.movieId,
    movieTitle: t.movieTitle,
    type: t.type,
    amount: t.amount,
    status: t.status,
    createdAt: t.createdAt,
  };
}

function mapAdminTransaction(t: BackendTransactionAdmin): Transaction {
  const username = t.user?.username ?? "Unknown user";
  return {
    id: t.id,
    userId: t.userId,
    userName: username,
    userAvatarUrl: avatarFor(username),
    movieId: t.movieId,
    movieTitle: t.movieTitle,
    type: t.type,
    amount: t.amount,
    status: t.status,
    createdAt: t.createdAt,
  };
}

export interface TransactionQuery extends PaginationParams {
  userId?: string;
}

export const paymentService = {
  /** All transactions platform-wide — Super Admin only (FINANCE_VIEW permission). */
  async getTransactions(query: TransactionQuery = {}): Promise<PaginatedResponse<Transaction>> {
    const res = await apiClient.get<PaginatedResponse<BackendTransactionAdmin>>("/transactions", {
      params: query,
    });
    return { ...res, items: res.items.map(mapAdminTransaction) };
  },

  /**
   * A user's transaction history. Routes to the self-service wallet
   * endpoint (any authenticated role) when viewing your own history, or
   * the Super-Admin-only admin endpoint when viewing someone else's.
   */
  async getTransactionsByUser(
    userId: string,
    pagination: PaginationParams = {},
  ): Promise<PaginatedResponse<Transaction>> {
    const self = tokenStore.getUser();
    if (self && self.id === userId) {
      const res = await apiClient.get<PaginatedResponse<BackendTransactionSelf>>(
        "/wallet/transactions",
        { params: pagination },
      );
      return { ...res, items: res.items.map((t) => mapSelfTransaction(t, self.username)) };
    }

    return paymentService.getTransactions({ ...pagination, userId });
  },

  getFinanceSummary() {
    return apiClient.get<FinanceSummary>("/finance/dashboard");
  },

  getRevenueTrend() {
    return apiClient.get<{ daily: RevenuePoint[]; weekly: RevenuePoint[]; monthly: RevenuePoint[] }>(
      "/finance/revenue-trend",
    );
  },
};
