import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  PaymentAccount,
  PaymentAccountFormValues,
  PaymentAccountType,
  PaymentMethodTypeFormValues,
} from "@/types/payment-account";
import type {
  PaymentAccountTransaction,
  PaymentAccountTransactionEntry,
  PaymentAccountTransactionType,
  RecordPaymentAccountTransactionValues,
} from "@/types/payment-account-transaction";

export interface PaymentAccountTransactionQuery extends PaginationParams {
  type?: PaymentAccountTransactionType;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
}

export interface AllPaymentAccountTransactionsQuery extends PaymentAccountTransactionQuery {
  paymentAccountId?: string;
}

export const paymentAccountService = {
  getAccounts() {
    return apiClient.get<PaymentAccount[]>("/payment-accounts");
  },

  getAccount(id: string) {
    return apiClient.get<PaymentAccount>(`/payment-accounts/${id}`);
  },

  getTypes() {
    return apiClient.get<PaymentAccountType[]>("/payment-accounts/types");
  },

  createAccount(values: PaymentAccountFormValues) {
    return apiClient.post<PaymentAccount>("/payment-accounts", values);
  },

  updateAccount(id: string, values: Partial<PaymentAccountFormValues>) {
    return apiClient.patch<PaymentAccount>(`/payment-accounts/${id}`, values);
  },

  deleteAccount(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/payment-accounts/${id}`);
  },

  createType(values: PaymentMethodTypeFormValues) {
    return apiClient.post<PaymentAccountType>("/payment-accounts/types", values);
  },

  updateType(id: string, values: Partial<PaymentMethodTypeFormValues>) {
    return apiClient.patch<PaymentAccountType>(`/payment-accounts/types/${id}`, values);
  },

  deleteType(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/payment-accounts/types/${id}`);
  },

  /** Per-account transaction history — backs the account detail page. */
  getTransactions(accountId: string, query: PaymentAccountTransactionQuery = {}) {
    return apiClient.get<PaginatedResponse<PaymentAccountTransaction>>(
      `/payment-accounts/${accountId}/transactions`,
      { params: query },
    );
  },

  /** Cross-account transaction view — backs the central transactions page. */
  getAllTransactions(query: AllPaymentAccountTransactionsQuery = {}) {
    return apiClient.get<PaginatedResponse<PaymentAccountTransaction>>(
      "/payment-accounts/transactions",
      { params: query },
    );
  },

  /** Manual Add/Remove Money. */
  recordTransaction(accountId: string, values: RecordPaymentAccountTransactionValues) {
    return apiClient.post<{ account: PaymentAccount; entry: PaymentAccountTransactionEntry }>(
      `/payment-accounts/${accountId}/transactions`,
      values,
    );
  },
};
