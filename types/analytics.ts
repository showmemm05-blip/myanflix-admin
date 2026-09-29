export interface RevenuePoint {
  label: string;
  revenue: number;
}

export interface UserGrowthPoint {
  label: string;
  newUsers: number;
  activeUsers: number;
}

export interface MovieAnalyticsEntry {
  movie: { id: string; title: string; posterUrl: string | null } | null;
  viewCount?: number;
  averageCompletionRate?: number;
  revenue?: number;
  purchaseCount?: number;
}

/** GET /analytics/overview (DASHBOARD.VIEW). */
export interface AnalyticsOverview {
  totalViews: number;
  averageCompletionRate: number;
  averageWatchDurationSeconds: number;
  popularMovies: MovieAnalyticsEntry[];
  userRegistrations: { last7Days: number; last30Days: number };
  /** Null unless the caller holds FINANCE.VIEW — the query is not even run. */
  revenue: number | null;
  totalMovies: number;
  totalUsers: number;
  activeUsers: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  topMovies: MovieAnalyticsEntry[];
  topUsers: {
    user: { id: string; username: string; displayName: string | null } | null;
    totalSpent: number;
    purchaseCount: number;
  }[];
}
