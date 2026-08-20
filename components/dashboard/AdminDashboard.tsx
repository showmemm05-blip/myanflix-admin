"use client";

import { Banknote, Eye, Film, Lock, TrendingUp, Users as UsersIcon, UserCheck } from "lucide-react";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { UserGrowthChart } from "@/components/charts/UserGrowthChart";
import { MovieAnalyticsPanel } from "@/components/charts/MovieAnalyticsPanel";
import { RecentTransactionsTable } from "@/components/finance/RecentTransactionsTable";
import { RecentUsersTable } from "@/components/users/RecentUsersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { analyticsService } from "@/services/api/analyticsService";
import { paymentService } from "@/services/api/paymentService";
import { userService } from "@/services/api/userService";
import { useRole } from "@/lib/context/role-context";

async function loadDashboardData() {
  const [summary, revenue, growth, movieAnalytics, transactions, users] = await Promise.all([
    analyticsService.getDashboardSummary(),
    analyticsService.getRevenueSeries(),
    analyticsService.getUserGrowthSeries(),
    analyticsService.getMovieAnalytics(),
    paymentService.getTransactions({ limit: 6 }),
    userService.getUsers({ limit: 6 }),
  ]);

  return {
    summary,
    revenue,
    growth,
    movieAnalytics,
    recentTransactions: transactions.items,
    recentUsers: [...users.items].sort((a, b) => (a.joinDate < b.joinDate ? 1 : -1)),
  };
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-lg lg:col-span-2" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useLanguage();
  const { can } = useRole();
  const { data, isLoading, error, refetch } = useAsyncData(loadDashboardData, []);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) {
    return <ErrorState description={t.dashboard.loadErrorAdmin} onRetry={refetch} />;
  }

  const { summary, revenue, growth, movieAnalytics, recentTransactions, recentUsers } = data;
  // Revenue figures and the platform-wide transaction feed both come
  // from FINANCE-gated endpoints — without the permission the cards would
  // only ever render a 403.
  const canViewFinance = can("FINANCE.VIEW");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardCard
          title={t.dashboard.totalMovies}
          value={summary.totalMovies.toLocaleString()}
          icon={Film}
          iconClassName="bg-chart-5/15 text-chart-5"
        />
        <DashboardCard
          title={t.dashboard.totalUsers}
          value={summary.totalUsers.toLocaleString()}
          icon={UsersIcon}
          iconClassName="bg-info/15 text-info"
        />
        <DashboardCard
          title={t.dashboard.activeUsers}
          value={summary.activeUsers.toLocaleString()}
          icon={UserCheck}
          iconClassName="bg-info/15 text-info"
        />
        {canViewFinance ? (
          <>
            <DashboardCard
              title={t.dashboard.totalRevenue}
              value={formatKyat(summary.totalRevenue)}
              icon={Banknote}
            />
            <DashboardCard
              title={t.dashboard.monthlyRevenue}
              value={formatKyat(summary.monthlyRevenue)}
              icon={TrendingUp}
            />
          </>
        ) : (
          <Card className="glass-card col-span-1 sm:col-span-2">
            <CardContent className="flex h-full items-center justify-center gap-2 p-5 text-center text-sm text-muted-foreground">
              <Lock className="size-4" />
              {t.dashboard.revenueRestricted}
            </CardContent>
          </Card>
        )}
        <DashboardCard
          title={t.dashboard.totalViews}
          value={summary.totalViews.toLocaleString()}
          icon={Eye}
          iconClassName="bg-chart-5/15 text-chart-5"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canViewFinance ? (
            <RevenueChart daily={revenue.daily} weekly={revenue.weekly} monthly={revenue.monthly} />
          ) : (
            <Card className="glass-card h-full">
              <CardHeader>
                <CardTitle>{t.dashboard.revenue}</CardTitle>
              </CardHeader>
              <CardContent className="flex h-72 flex-col items-center justify-center gap-2 text-center">
                <Lock className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t.dashboard.revenueRestrictedDetail}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        <UserGrowthChart data={growth} />
      </div>

      <MovieAnalyticsPanel
        mostWatched={movieAnalytics.mostWatched}
        mostPurchased={movieAnalytics.mostPurchased}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.dashboard.recentTransactions}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactionsTable transactions={recentTransactions} />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.dashboard.recentUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentUsersTable users={recentUsers} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
