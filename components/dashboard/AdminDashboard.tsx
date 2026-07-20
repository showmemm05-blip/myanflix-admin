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
import { formatKyatWhole } from "@/lib/currency";
import { analyticsService } from "@/services/api/analyticsService";
import { paymentService } from "@/services/api/paymentService";
import { userService } from "@/services/api/userService";
import type { UserRole } from "@/types/user";

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
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export function AdminDashboard({ role }: { role: UserRole }) {
  const { data, isLoading, error, refetch } = useAsyncData(loadDashboardData, []);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) {
    return <ErrorState description="We couldn't load the dashboard analytics." onRetry={refetch} />;
  }

  const { summary, revenue, growth, movieAnalytics, recentTransactions, recentUsers } = data;
  const canViewFinance = role === "SUPER_ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardCard title="Total Movies" value={summary.totalMovies.toLocaleString()} icon={Film} />
        <DashboardCard title="Total Users" value={summary.totalUsers.toLocaleString()} icon={UsersIcon} />
        <DashboardCard
          title="Active Users"
          value={summary.activeUsers.toLocaleString()}
          icon={UserCheck}
        />
        {canViewFinance ? (
          <>
            <DashboardCard
              title="Total Revenue"
              value={formatKyatWhole(summary.totalRevenue)}
              icon={Banknote}
            />
            <DashboardCard
              title="Monthly Revenue"
              value={formatKyatWhole(summary.monthlyRevenue)}
              icon={TrendingUp}
            />
          </>
        ) : (
          <Card className="glass-card col-span-1 border-white/[0.08] sm:col-span-2">
            <CardContent className="flex h-full items-center justify-center gap-2 p-5 text-center text-sm text-muted-foreground">
              <Lock className="size-4" />
              Revenue figures are restricted to Super Admin
            </CardContent>
          </Card>
        )}
        <DashboardCard title="Total Views" value={summary.totalViews.toLocaleString()} icon={Eye} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canViewFinance ? (
            <RevenueChart daily={revenue.daily} weekly={revenue.weekly} monthly={revenue.monthly} />
          ) : (
            <Card className="glass-card h-full border-white/[0.08]">
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
              </CardHeader>
              <CardContent className="flex h-72 flex-col items-center justify-center gap-2 text-center">
                <Lock className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Detailed revenue analytics are limited to Super Admin.
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
        <Card className="glass-card border-white/[0.08]">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactionsTable transactions={recentTransactions} />
          </CardContent>
        </Card>
        <Card className="glass-card border-white/[0.08]">
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentUsersTable users={recentUsers} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
