"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Receipt, Wallet } from "lucide-react";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { UserSpendingChart } from "@/components/finance/UserSpendingChart";
import { PaymentAccountsOverview } from "@/components/finance/PaymentAccountsOverview";
import { getTransactionColumns } from "@/components/finance/columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { getSocket, onResync } from "@/lib/socket";
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

/**
 * One approval emits several of the events above in a row (e.g.
 * payment-account.updated AND deposit.updated), so they are coalesced: the
 * page reloads once, this long after the last event of a burst.
 */
const FINANCE_REFRESH_DEBOUNCE_MS = 1500;
/** Rows per page of the "All transactions" table — the backend's own default page size, so page 1 is what this table always showed. */
const TRANSACTIONS_PAGE_LIMIT = 20;

function useFinanceRealtimeRefresh(refetch: () => void) {
  const refetchSoon = useDebouncedCallback(refetch, FINANCE_REFRESH_DEBOUNCE_MS);
  useEffect(() => {
    // Staff pushes go to permission rooms (H-3): deposit.* / withdrawal.*
    // reach only DEPOSITS.VIEW / WITHDRAWALS.VIEW holders, so a finance-only
    // role gets none of them. A reconnect or the tab coming back into view
    // refetches too, so this page cannot sit stale for such a role.
    const stopResync = onResync(refetchSoon);
    const socket = getSocket();
    if (!socket) return stopResync;
    const handleRefresh = () => refetchSoon();
    for (const event of FINANCE_REFRESH_EVENTS) {
      socket.on(event, handleRefresh);
    }
    return () => {
      stopResync();
      for (const event of FINANCE_REFRESH_EVENTS) {
        socket.off(event, handleRefresh);
      }
    };
  }, [refetchSoon]);
}

/**
 * The "All transactions" table, paged on the server. The backend's
 * /transactions has no search (TransactionQueryDto takes only page, limit
 * and userId), so the old search box — which only filtered the one page in
 * hand — is gone rather than half-working.
 */
function useTransactionsPage() {
  const [page, setPage] = useState(1);
  const result = useAsyncData(
    () => paymentService.getTransactions({ page, limit: TRANSACTIONS_PAGE_LIMIT }),
    [page],
  );
  return { ...result, page, setPage };
}

function TransactionsCard({ tx }: { tx: ReturnType<typeof useTransactionsPage> }) {
  const { t } = useLanguage();
  const transactions = tx.data;
  if (!transactions) return null;
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t.finance.allTransactions}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={getTransactionColumns(t)}
          data={transactions.items}
          pageSize={TRANSACTIONS_PAGE_LIMIT}
          manualPagination
          // Skeleton rows only while a different page is on its way — a
          // live refresh of the same page keeps the rows on screen.
          isLoading={tx.isLoading && transactions.page !== tx.page}
        />
        <ServerPagination
          page={tx.page}
          pageSize={TRANSACTIONS_PAGE_LIMIT}
          total={transactions.total}
          onPageChange={tx.setPage}
        />
      </CardContent>
    </Card>
  );
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
  const { data, isInitialLoading, error, refetch } = useAsyncData(async () => {
    const [summary, revenue] = await Promise.all([
      paymentService.getFinanceSummary(),
      analyticsService.getRevenueSeries(),
    ]);
    return { summary, revenue };
  }, []);
  const tx = useTransactionsPage();
  const refetchTx = tx.refetch;
  const refetchAll = useCallback(() => {
    refetch();
    refetchTx();
  }, [refetch, refetchTx]);
  useFinanceRealtimeRefresh(refetchAll);

  // The skeleton is only for the first load; a live refresh keeps the
  // current figures on screen (and PaymentAccountsOverview mounted).
  if (isInitialLoading || tx.isInitialLoading) return <FinanceSkeleton />;
  if (error || tx.error || !data || !tx.data) {
    return <ErrorState description={t.finance.loadError} onRetry={refetchAll} />;
  }

  const { summary, revenue } = data;
  const transactions = tx.data;
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

      <PaymentAccountsOverview />

      <RevenueChart daily={revenue.daily} weekly={revenue.weekly} monthly={revenue.monthly} />

      <UserSpendingChart topUsers={summary.topUsers} />

      <TransactionsCard tx={tx} />

      <p className="text-xs text-muted-foreground tabular-nums">
        {t.finance.averagePurchase(formatKyat(averagePurchase))}
      </p>
    </div>
  );
}

function AdminFinanceView() {
  const { t } = useLanguage();
  const { data, isInitialLoading, error, refetch } = useAsyncData(() => paymentService.getFinanceSummary(), []);
  const tx = useTransactionsPage();
  const refetchTx = tx.refetch;
  const refetchAll = useCallback(() => {
    refetch();
    refetchTx();
  }, [refetch, refetchTx]);
  useFinanceRealtimeRefresh(refetchAll);

  // See SuperAdminFinanceView: skeleton on the first load only.
  if (isInitialLoading || tx.isInitialLoading) return <FinanceSkeleton />;
  if (error || tx.error || !data || !tx.data) {
    return <ErrorState description={t.finance.loadError} onRetry={refetchAll} />;
  }

  const summary = data;
  const transactions = tx.data;

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

      <PaymentAccountsOverview />

      <Card className="glass-card">
        <CardContent className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Lock className="size-4" />
          {t.finance.revenueRestrictedNotice}
        </CardContent>
      </Card>

      <TransactionsCard tx={tx} />
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
