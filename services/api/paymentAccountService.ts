import { apiClient } from "./apiClient";
import type {
  PaymentAccount,
  PaymentAccountFormValues,
  PaymentAccountType,
  PaymentMethodTypeFormValues,
} from "@/types/payment-account";

export const paymentAccountService = {
  getAccounts() {
    return apiClient.get<PaymentAccount[]>("/payment-accounts");
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
};
