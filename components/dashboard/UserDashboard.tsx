"use client";

import Link from "next/link";
import { Clapperboard, History, ShoppingBag, Wallet } from "lucide-react";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { RecentTransactionsTable } from "@/components/finance/RecentTransactionsTable";
import { WatchHistoryList } from "@/components/users/WatchHistoryList";
import { PurchaseHistoryList } from "@/components/users/PurchaseHistoryList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { formatKyat } from "@/lib/currency";
import { userService } from "@/services/api/userService";
import { paymentService } from "@/services/api/paymentService";
import { useRole } from "@/lib/context/role-context";

export function UserDashboard() {
  const { currentUser } = useRole();

  const { data, isLoading, error, refetch } = useAsyncData(
    async () => {
      const [watchHistory, purchases, transactions] = await Promise.all([
        userService.getWatchHistory(currentUser.id),
        userService.getPurchaseHistory(currentUser.id),
        paymentService.getTransactionsByUser(currentUser.id),
      ]);
      return { watchHistory, purchases, transactions };
    },
    [currentUser.id]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState description="We couldn't load your account overview." onRetry={refetch} />;
  }

  const { watchHistory, purchases, transactions } = data;
  const watchHistoryItems = watchHistory.items;
  const purchaseItems = purchases.items;
  const transactionItems = transactions.items;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Account Balance" value={formatKyat(currentUser.balance)} icon={Wallet} />
        <DashboardCard
          title="Total Deposited"
          value={formatKyat(currentUser.totalDeposited)}
          icon={ShoppingBag}
        />
        <DashboardCard title="Total Spent" value={formatKyat(currentUser.totalSpent)} icon={History} />
        <DashboardCard
          title="Movies Purchased"
          value={currentUser.moviesPurchased.toString()}
          icon={Clapperboard}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="glass-card border-white/[0.08]">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Continue Watching</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/movies" />} nativeButton={false}>
              Browse all
            </Button>
          </CardHeader>
          <CardContent>
            <WatchHistoryList entries={watchHistoryItems} />
          </CardContent>
        </Card>

        <Card className="glass-card border-white/[0.08]">
          <CardHeader>
            <CardTitle>Purchased Movies</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseHistoryList entries={purchaseItems} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/[0.08]">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentTransactionsTable transactions={transactionItems} />
        </CardContent>
      </Card>
    </div>
  );
}
