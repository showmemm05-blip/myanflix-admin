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
import { cn } from "@/lib/utils";

/** A block the caller's role may not read — a plain lock, never a 403 error. */
function RestrictedNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground", className)}>
      <Lock className="size-5" />
      <p>{message}</p>
    </div>
  );
}

/**
 * The landing page for every role with DASHBOARD.VIEW. Each block loads on
 * its own and only when the role holds that block's permission (H-26): the
 * headline counts and user growth need only DASHBOARD.VIEW, revenue and the
 * transaction feed need FINANCE.VIEW, the newest users need USERS.VIEW. One
 * refused or failed call therefore costs its own block, never the page —
 * the seeded Admin role (no FINANCE.VIEW, no USERS.VIEW) used to get a
 * whole-page load error here as its first screen.
 */
export function AdminDashboard() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canViewFinance = can("FINANCE.VIEW");
  const canViewUsers = can("USERS.VIEW");

  const overview = useAsyncData(() => analyticsService.getOverview(), []);
  const growth = useAsyncData(() => analyticsService.getUserGrowthSeries(), []);
  // Never requested without the permission — the endpoints would only 403.
  const finance = useAsyncData(
    () => (canViewFinance ? paymentService.getFinanceSummary() : Promise.resolve(null)),
    [canViewFinance],
  );
  const revenue = useAsyncData(
    () => (canViewFinance ? analyticsService.getRevenueSeries() : Promise.resolve(null)),
    [canViewFinance],
  );
  const transactions = useAsyncData(
    () => (canViewFinance ? paymentService.getTransactions({ limit: 6 }) : Promise.resolve(null)),
    [canViewFinance],
  );
  const recentUsers = useAsyncData(
    () =>
      canViewUsers
        ? userService
            .getUsers({ limit: 6 })
            .then((res) => [...res.items].sort((a, b) => (a.joinDate < b.joinDate ? 1 : -1)))
        : Promise.resolve(null),
    [canViewUsers],
  );

  const blockError = (onRetry: () => void, className?: string) => (
    <ErrorState description={t.dashboard.blockLoadError} onRetry={onRetry} className={className ?? "py-10"} />
  );

  // A revenue card shows "—" when its block failed; the retry lives on the
  // revenue chart's block right below.
  const revenueValue = (pick: (summary: NonNullable<typeof finance.data>) => number) =>
    finance.data ? formatKyat(pick(finance.data)) : "—";

  return (
    <div className="flex flex-col gap-6">
      {overview.error ? (
        blockError(overview.refetch)
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {overview.isLoading || !overview.data ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          ) : (
            <>
              <DashboardCard
                title={t.dashboard.totalMovies}
                value={overview.data.totalMovies.toLocaleString()}
                icon={Film}
                iconClassName="bg-chart-5/15 text-chart-5"
              />
              <DashboardCard
                title={t.dashboard.totalUsers}
                value={overview.data.totalUsers.toLocaleString()}
                icon={UsersIcon}
                iconClassName="bg-info/15 text-info"
              />
              <DashboardCard
                title={t.dashboard.activeUsers}
                value={overview.data.activeUsers.toLocaleString()}
                icon={UserCheck}
                iconClassName="bg-info/15 text-info"
              />
              {canViewFinance ? (
                finance.isLoading ? (
                  <>
                    <Skeleton className="h-28 rounded-lg" />
                    <Skeleton className="h-28 rounded-lg" />
                  </>
                ) : (
                  <>
                    <DashboardCard
                      title={t.dashboard.totalRevenue}
                      value={revenueValue((s) => s.totalRevenue)}
                      icon={Banknote}
                    />
                    <DashboardCard
                      title={t.dashboard.monthlyRevenue}
                      value={revenueValue((s) => s.monthlyRevenue)}
                      icon={TrendingUp}
                    />
                  </>
                )
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
                value={overview.data.totalViews.toLocaleString()}
                icon={Eye}
                iconClassName="bg-chart-5/15 text-chart-5"
              />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!canViewFinance ? (
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
          ) : revenue.error || finance.error ? (
            blockError(() => {
              revenue.refetch();
              finance.refetch();
            }, "h-full py-10")
          ) : revenue.isLoading || !revenue.data ? (
            <Skeleton className="h-96 rounded-lg" />
          ) : (
            <RevenueChart daily={revenue.data.daily} weekly={revenue.data.weekly} monthly={revenue.data.monthly} />
          )}
        </div>
        {growth.error ? (
          blockError(growth.refetch, "h-full py-10")
        ) : growth.isLoading || !growth.data ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : (
          <UserGrowthChart data={growth.data} />
        )}
      </div>

      {overview.data && (
        <MovieAnalyticsPanel
          mostWatched={overview.data.popularMovies}
          // Purchase ranking comes from the FINANCE-gated summary — without
          // the permission (or while it loads) the tab is simply not offered.
          mostPurchased={canViewFinance ? (finance.data?.topMovies ?? null) : null}
        />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.dashboard.recentTransactions}</CardTitle>
          </CardHeader>
          <CardContent>
            {!canViewFinance ? (
              <RestrictedNotice message={t.dashboard.recentTransactionsRestricted} className="h-48" />
            ) : transactions.error ? (
              blockError(transactions.refetch)
            ) : transactions.isLoading || !transactions.data ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : (
              <RecentTransactionsTable transactions={transactions.data.items} />
            )}
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.dashboard.recentUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            {!canViewUsers ? (
              <RestrictedNotice message={t.dashboard.recentUsersRestricted} className="h-48" />
            ) : recentUsers.error ? (
              blockError(recentUsers.refetch)
            ) : recentUsers.isLoading || !recentUsers.data ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : (
              <RecentUsersTable users={recentUsers.data} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
