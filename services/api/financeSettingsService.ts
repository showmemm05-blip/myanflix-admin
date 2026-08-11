import { apiClient } from "./apiClient";
import type { FinanceSettings, FinanceSettingsFormValues } from "@/types/finance-settings";

export const financeSettingsService = {
  get() {
    return apiClient.get<FinanceSettings>("/finance-settings");
  },

  update(values: FinanceSettingsFormValues) {
    return apiClient.patch<FinanceSettings>("/finance-settings", values);
  },
};
