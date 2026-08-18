"use client";

import { useEffect } from "react";
import { Lock, Receipt, Wallet } from "lucide-react";
import { RequireRole } from "@/components/shared/RequireRole";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { DataTable } from "@/components/tables/DataTable";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { UserSpendingChart } from "@/components/finance/UserSpendingChart";
import { getTransactionColumns } from "@/components/finance/columns";
import { PurchaseHistoryList } from "@/components/users/PurchaseHistoryList";
import { WatchHistoryList } from "@/components/users/WatchHistoryList";
import { RecentTransactionsTable } from "@/components/finance/RecentTransactionsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { getSocket } from "@/lib/socket";
import { analyticsService } from "@/services/api/analyticsService";
import { paymentService } from "@/services/api/paymentService";
import { userService } from "@/services/api/userService";

/**
 * Every event that can change what this page shows — new/updated deposits
 * and withdrawals move both the transaction list and the revenue/summary
 * cards, and a payment-account ledger entry can originate from either. Kept
 * as a plain refetch (not a patch) since summary/revenue are aggregates
 * recomputed server-side, not values this page could derive from an event
 * payload alone.
 */
const FINANCE_REFRESH_EVENTS = [
  "deposit.created",
  "deposit.updated",
  "withdrawal.created",
  "withdrawal.updated",
  "payment-account.updated",
] as const;

function useFinanceRealtimeRefresh(refetch: () => void) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleRefresh = () => refetch();
    for (const event of FINANCE_REFRESH_EVENTS) {
      socket.on(event, handleRefresh);
    }
    return () => {
      for (const event of FINANCE_REFRESH_EVENTS) {
        socket.off(event, handleRefresh);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function FinanceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

function SuperAdminFinanceView() {
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(async () => {
    const [summary, revenue, transactions] = await Promise.all([
      paymentService.getFinanceSummary(),
      analyticsService.getRevenueSeries(),
      paymentService.getTransactions(),
    ]);
    return { summary, revenue, transactions };
  }, []);
  useFinanceRealtimeRefresh(refetch);

  if (isLoading) return <FinanceSkeleton />;
  if (error || !data) {
    return <ErrorState description={t.finance.loadError} onRetry={refetch} />;
  }

  const { summary, revenue, transactions } = data;
  const averagePurchase = transactions.total > 0 ? summary.totalRevenue / transactions.total : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title={t.dashboard.totalRevenue} value={formatKyat(summary.totalRevenue)} icon={Wallet} />
        <DashboardCard title={t.dashboard.monthlyRevenue} value={formatKyat(summary.monthlyRevenue)} icon={Wallet} />
        <DashboardCard title={t.finance.dailyRevenue} value={formatKyat(summary.dailyRevenue)} icon={Wallet} />
        <DashboardCard
          title={t.finance.totalTransactions}
          value={transactions.total.toLocaleString()}
          icon={Receipt}
          iconClassName="bg-info/15 text-info"
        />
      </div>

      <RevenueChart daily={revenue.daily} weekly={revenue.weekly} monthly={revenue.monthly} />

      <UserSpendingChart topUsers={summary.topUsers} />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t.finance.allTransactions}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={getTransactionColumns(t)}
            data={transactions.items}
            searchKey="userName"
            searchPlaceholder={t.finance.searchByUserName}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground tabular-nums">
        {t.finance.averagePurchase(formatKyat(averagePurchase))}
      </p>
    </div>
  );
}

function AdminFinanceView() {
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(async () => {
    const [summary, transactions] = await Promise.all([
      paymentService.getFinanceSummary(),
      paymentService.getTransactions(),
    ]);
    return { summary, transactions };
  }, []);
  useFinanceRealtimeRefresh(refetch);

  if (isLoading) return <FinanceSkeleton />;
  if (error || !data) {
    return <ErrorState description={t.finance.loadError} onRetry={refetch} />;
  }

  const { summary, transactions } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title={t.dashboard.totalRevenue} value={formatKyat(summary.totalRevenue)} icon={Wallet} />
        <DashboardCard title={t.dashboard.monthlyRevenue} value={formatKyat(summary.monthlyRevenue)} icon={Wallet} />
        <DashboardCard title={t.finance.dailyRevenue} value={formatKyat(summary.dailyRevenue)} icon={Wallet} />
        <DashboardCard
          title={t.finance.totalTransactions}
          value={transactions.total.toLocaleString()}
          icon={Receipt}
          iconClassName="bg-info/15 text-info"
        />
      </div>

      <Card className="glass-card">
        <CardContent className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Lock className="size-4" />
          {t.finance.revenueRestrictedNotice}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t.finance.allTransactions}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={getTransactionColumns(t)}
            data={transactions.items}
            searchKey="userName"
            searchPlaceholder={t.finance.searchByUserName}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function UserCashFlowView() {
  const { t } = useLanguage();
  const { currentUser } = useRole();

  const { data, isLoading, error, refetch } = useAsyncData(
    async () => {
      const [transactions, purchases, watchHistory] = await Promise.all([
        paymentService.getTransactionsByUser(currentUser.id),
        userService.getPurchaseHistory(currentUser.id),
        userService.getWatchHistory(currentUser.id),
      ]);
      return { transactions, purchases, watchHistory };
    },
    [currentUser.id]
  );
  // A USER-role socket only joins their own room, so deposit.updated /
  // withdrawal.updated here can only ever be this viewer's own — no
  // cross-user leakage risk from a blanket refetch.
  useFinanceRealtimeRefresh(refetch);

  if (isLoading) return <FinanceSkeleton />;
  if (error || !data) {
    return <ErrorState description={t.finance.loadErrorCashFlow} onRetry={refetch} />;
  }

  const { transactions, purchases, watchHistory } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title={t.finance.balance} value={formatKyat(currentUser.balance)} icon={Wallet} />
        <DashboardCard
          title={t.dashboard.totalDeposited}
          value={formatKyat(currentUser.totalDeposited)}
          icon={Wallet}
          iconClassName="bg-income/15 text-income"
        />
        <DashboardCard
          title={t.dashboard.totalSpent}
          value={formatKyat(currentUser.totalSpent)}
          icon={Receipt}
          iconClassName="bg-outgoing/15 text-outgoing"
        />
        <DashboardCard
          title={t.dashboard.subscription}
          value={currentUser.isSubscribed ? t.dashboard.subscribed : t.dashboard.notSubscribed}
          icon={Receipt}
          iconClassName="bg-chart-5/15 text-chart-5"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.dashboard.purchasedMovies}</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseHistoryList entries={purchases.items} />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.users.profile.watchHistoryTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <WatchHistoryList entries={watchHistory.items} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t.dashboard.transactionHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.items.length ? (
            <RecentTransactionsTable transactions={transactions.items} />
          ) : (
            <EmptyState icon={Receipt} title={t.finance.noTransactionsTitle} description={t.finance.noTransactionsDescription} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FinancePage() {
  const { role } = useRole();
  const { t } = useLanguage();

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN", "USER"]}
      title={t.finance.page.title}
      description={t.finance.page.description}
    >
      <div>
        {role === "SUPER_ADMIN" && <SuperAdminFinanceView />}
        {role === "ADMIN" && <AdminFinanceView />}
        {role === "USER" && <UserCashFlowView />}
      </div>
    </RequireRole>
  );
}
