import { apiClient } from "./apiClient";
import type { SubscriptionPlan, SubscriptionPlanFormValues } from "@/types/subscription";

export const subscriptionService = {
  getPlans() {
    return apiClient.get<SubscriptionPlan[]>("/subscription-plans");
  },

  createPlan(values: SubscriptionPlanFormValues) {
    return apiClient.post<SubscriptionPlan>("/subscription-plans", values);
  },

  updatePlan(id: string, values: Partial<SubscriptionPlanFormValues>) {
    return apiClient.put<SubscriptionPlan>(`/subscription-plans/${id}`, values);
  },
};
