"use client";

import { useEffect } from "react";
import { Lock, Receipt, Wallet } from "lucide-react";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { DataTable } from "@/components/tables/DataTable";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { UserSpendingChart } from "@/components/finance/UserSpendingChart";
import { getTransactionColumns } from "@/components/finance/columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { getSocket } from "@/lib/socket";
import { analyticsService } from "@/services/api/analyticsService";
import { paymentService } from "@/services/api/paymentService";

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

export default function FinancePage() {
  const { can } = useRole();
  const { t } = useLanguage();

  return (
    <RequirePermission
      permission="FINANCE.VIEW"
      title={t.finance.page.title}
      description={t.finance.page.description}
    >
      <div>
        {/* FINANCE.VIEW opens the summary and the transaction ledger;
            FINANCE.EXPORT is what additionally unlocks the revenue
            breakdown (trend chart + top spenders). Without it the page
            keeps the same restricted-revenue notice it has always shown to
            non-Super-Admins. */}
        {can("FINANCE.EXPORT") ? <SuperAdminFinanceView /> : <AdminFinanceView />}
      </div>
    </RequirePermission>
  );
}
