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

export interface DashboardSummary {
  totalMovies: number;
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalViews: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  topMovies: MovieAnalyticsEntry[];
  topUsers: { user: { id: string; username: string; email: string } | null; totalSpent: number; purchaseCount: number }[];
}
