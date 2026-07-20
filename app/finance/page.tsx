"use client";

import { Lock, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { DataTable } from "@/components/tables/DataTable";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { UserSpendingChart } from "@/components/finance/UserSpendingChart";
import { transactionColumns } from "@/components/finance/columns";
import { PurchaseHistoryList } from "@/components/users/PurchaseHistoryList";
import { WatchHistoryList } from "@/components/users/WatchHistoryList";
import { RecentTransactionsTable } from "@/components/finance/RecentTransactionsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { formatKyat } from "@/lib/currency";
import { analyticsService } from "@/services/api/analyticsService";
import { paymentService } from "@/services/api/paymentService";
import { userService } from "@/services/api/userService";

function FinanceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function SuperAdminFinanceView() {
  const { data, isLoading, error, refetch } = useAsyncData(async () => {
    const [summary, revenue, transactions] = await Promise.all([
      paymentService.getFinanceSummary(),
      analyticsService.getRevenueSeries(),
      paymentService.getTransactions(),
    ]);
    return { summary, revenue, transactions };
  }, []);

  if (isLoading) return <FinanceSkeleton />;
  if (error || !data) {
    return <ErrorState description="We couldn't load finance data." onRetry={refetch} />;
  }

  const { summary, revenue, transactions } = data;
  const averagePurchase = transactions.total > 0 ? summary.totalRevenue / transactions.total : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Total Revenue" value={formatKyat(summary.totalRevenue)} icon={Wallet} />
        <DashboardCard title="Monthly Revenue" value={formatKyat(summary.monthlyRevenue)} icon={Wallet} />
        <DashboardCard title="Daily Revenue" value={formatKyat(summary.dailyRevenue)} icon={Wallet} />
        <DashboardCard
          title="Total Transactions"
          value={transactions.total.toLocaleString()}
          icon={Receipt}
        />
      </div>

      <RevenueChart daily={revenue.daily} weekly={revenue.weekly} monthly={revenue.monthly} />

      <UserSpendingChart topUsers={summary.topUsers} />

      <Card className="glass-card border-white/[0.08]">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={transactionColumns}
            data={transactions.items}
            searchKey="userName"
            searchPlaceholder="Search by user name..."
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Average purchase: {formatKyat(averagePurchase)}
      </p>
    </div>
  );
}

function AdminFinanceView() {
  const { data, isLoading, error, refetch } = useAsyncData(async () => {
    const [summary, transactions] = await Promise.all([
      paymentService.getFinanceSummary(),
      paymentService.getTransactions(),
    ]);
    return { summary, transactions };
  }, []);

  if (isLoading) return <FinanceSkeleton />;
  if (error || !data) {
    return <ErrorState description="We couldn't load finance data." onRetry={refetch} />;
  }

  const { summary, transactions } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Total Revenue" value={formatKyat(summary.totalRevenue)} icon={Wallet} />
        <DashboardCard title="Monthly Revenue" value={formatKyat(summary.monthlyRevenue)} icon={Wallet} />
        <DashboardCard title="Daily Revenue" value={formatKyat(summary.dailyRevenue)} icon={Wallet} />
        <DashboardCard
          title="Total Transactions"
          value={transactions.total.toLocaleString()}
          icon={Receipt}
        />
      </div>

      <Card className="glass-card border-white/[0.08]">
        <CardContent className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Lock className="size-4" />
          Detailed revenue charts are restricted to Super Admin. You have access to transaction records only.
        </CardContent>
      </Card>

      <Card className="glass-card border-white/[0.08]">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={transactionColumns}
            data={transactions.items}
            searchKey="userName"
            searchPlaceholder="Search by user name..."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function UserCashFlowView() {
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

  if (isLoading) return <FinanceSkeleton />;
  if (error || !data) {
    return <ErrorState description="We couldn't load your cash flow." onRetry={refetch} />;
  }

  const { transactions, purchases, watchHistory } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Balance" value={formatKyat(currentUser.balance)} icon={Wallet} />
        <DashboardCard
          title="Total Deposited"
          value={formatKyat(currentUser.totalDeposited)}
          icon={Wallet}
        />
        <DashboardCard title="Total Spent" value={formatKyat(currentUser.totalSpent)} icon={Receipt} />
        <DashboardCard
          title="Movies Purchased"
          value={`${currentUser.moviesPurchased}`}
          icon={Receipt}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="glass-card border-white/[0.08]">
          <CardHeader>
            <CardTitle>Purchased Movies</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseHistoryList entries={purchases.items} />
          </CardContent>
        </Card>
        <Card className="glass-card border-white/[0.08]">
          <CardHeader>
            <CardTitle>Watch History</CardTitle>
          </CardHeader>
          <CardContent>
            <WatchHistoryList entries={watchHistory.items} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/[0.08]">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.items.length ? (
            <RecentTransactionsTable transactions={transactions.items} />
          ) : (
            <EmptyState icon={Receipt} title="No transactions yet" description="Your purchases will show up here." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FinancePage() {
  const { role } = useRole();

  return (
    <div>
      <PageHeader
        title={role === "USER" ? "My Cash Flow" : "Finance"}
        description={
          role === "USER"
            ? "Your balance, spending and transaction history."
            : "Revenue, transactions and payment analytics."
        }
      />
      {role === "SUPER_ADMIN" && <SuperAdminFinanceView />}
      {role === "ADMIN" && <AdminFinanceView />}
      {role === "USER" && <UserCashFlowView />}
    </div>
  );
}
