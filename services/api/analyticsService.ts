import { apiClient } from "./apiClient";
import type { DashboardSummary, MovieAnalyticsEntry, UserGrowthPoint } from "@/types/analytics";

interface AnalyticsOverview {
  totalViews: number;
  averageCompletionRate: number;
  averageWatchDurationSeconds: number;
  popularMovies: MovieAnalyticsEntry[];
  userRegistrations: { last7Days: number; last30Days: number };
  revenue: number;
  totalMovies: number;
  totalUsers: number;
  activeUsers: number;
}

interface FinanceDashboard {
  totalRevenue: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  topMovies: MovieAnalyticsEntry[];
  topUsers: { user: { id: string; username: string; email: string } | null; totalSpent: number; purchaseCount: number }[];
}

export const analyticsService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const [overview, finance] = await Promise.all([
      apiClient.get<AnalyticsOverview>("/analytics/overview"),
      apiClient.get<FinanceDashboard>("/finance/dashboard"),
    ]);

    return {
      totalMovies: overview.totalMovies,
      totalUsers: overview.totalUsers,
      activeUsers: overview.activeUsers,
      totalRevenue: finance.totalRevenue,
      monthlyRevenue: finance.monthlyRevenue,
      totalViews: overview.totalViews,
    };
  },

  getRevenueSeries() {
    return apiClient.get<{
      daily: { label: string; revenue: number }[];
      weekly: { label: string; revenue: number }[];
      monthly: { label: string; revenue: number }[];
    }>("/finance/revenue-trend");
  },

  getUserGrowthSeries() {
    return apiClient.get<UserGrowthPoint[]>("/analytics/user-growth");
  },

  async getMovieAnalytics(): Promise<{
    mostWatched: MovieAnalyticsEntry[];
    mostPurchased: MovieAnalyticsEntry[];
  }> {
    const [overview, finance] = await Promise.all([
      apiClient.get<AnalyticsOverview>("/analytics/overview"),
      apiClient.get<FinanceDashboard>("/finance/dashboard"),
    ]);

    return { mostWatched: overview.popularMovies, mostPurchased: finance.topMovies };
  },
};
