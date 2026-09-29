import { apiClient } from "./apiClient";
import type { AnalyticsOverview, UserGrowthPoint } from "@/types/analytics";

export const analyticsService = {
  /**
   * The dashboard's headline counts and most-watched list — DASHBOARD.VIEW,
   * so every role that lands on the dashboard can load it (H-26). Its
   * `revenue` is null unless the caller holds FINANCE.VIEW; the revenue cards
   * read /finance/dashboard (paymentService.getFinanceSummary) instead, and
   * only for roles that hold it.
   */
  getOverview() {
    return apiClient.get<AnalyticsOverview>("/analytics/overview");
  },

  /** FINANCE.VIEW — callers without it must not ask (it would only 403). */
  getRevenueSeries() {
    return apiClient.get<{
      daily: { label: string; revenue: number }[];
      weekly: { label: string; revenue: number }[];
      monthly: { label: string; revenue: number }[];
    }>("/finance/revenue-trend");
  },

  /** DASHBOARD.VIEW (H-26). */
  getUserGrowthSeries() {
    return apiClient.get<UserGrowthPoint[]>("/analytics/user-growth");
  },
};
