"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clapperboard,
  History,
  ShieldCheck,
  ShoppingBag,
  UserX,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { AccessRestricted } from "@/components/shared/AccessRestricted";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EditRoleDialog } from "@/components/users/EditRoleDialog";
import { WatchHistoryList } from "@/components/users/WatchHistoryList";
import { PurchaseHistoryList } from "@/components/users/PurchaseHistoryList";
import { RecentTransactionsTable } from "@/components/finance/RecentTransactionsTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { formatKyat } from "@/lib/currency";
import { userService } from "@/services/api/userService";
import { paymentService } from "@/services/api/paymentService";
import { STATUS_LABELS, type UserStatus } from "@/types/user";
import { toast } from "sonner";

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, currentUser } = useRole();
  const canManage = role !== "USER";
  const isOwnProfile = currentUser.id === id;

  const { data, isLoading, error, refetch } = useAsyncData(
    async () => {
      const [user, watchHistory, purchases, transactions] = await Promise.all([
        userService.getUserById(id),
        userService.getWatchHistory(id),
        userService.getPurchaseHistory(id),
        paymentService.getTransactionsByUser(id),
      ]);
      return { user, watchHistory, purchases, transactions };
    },
    [id]
  );

  const [status, setStatus] = useState<UserStatus | null>(null);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspending, setSuspending] = useState(false);

  if (!canManage && !isOwnProfile) {
    return (
      <div>
        <PageHeader title="User Profile" />
        <AccessRestricted role={role} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="User Profile" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.user) {
    return (
      <div>
        <PageHeader title="User Profile" />
        {error ? (
          <ErrorState description="We couldn't load this user." onRetry={refetch} />
        ) : (
          <EmptyState
            icon={UserX}
            title="User not found"
            description="This account may have been removed."
            action={
              <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
                Back to Users
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const { user, watchHistory, purchases, transactions } = data;
  const currentStatus = status ?? user.status;

  const handleToggleSuspend = async () => {
    const nextStatus: UserStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setSuspending(true);
    await userService.updateUserStatus(user.id, nextStatus);
    setStatus(nextStatus);
    setSuspending(false);
    toast.success(nextStatus === "SUSPENDED" ? "User suspended" : "User reactivated");
    setSuspendOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="User Profile"
        actions={
          <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
            Back to Users
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <Card className="glass-card border-white/[0.08]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border border-border">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold">{user.name}</p>
                  <RoleBadge role={user.role} />
                  <StatusBadge label={STATUS_LABELS[currentStatus]} tone={STATUS_TONE[currentStatus]} />
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Joined {format(new Date(user.joinDate), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            {canManage && !isOwnProfile && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditRoleOpen(true)}>
                  <ShieldCheck className="size-4" />
                  Edit Role
                </Button>
                <Button
                  variant={currentStatus === "SUSPENDED" ? "outline" : "destructive"}
                  onClick={() => setSuspendOpen(true)}
                >
                  {currentStatus === "SUSPENDED" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  {currentStatus === "SUSPENDED" ? "Reactivate" : "Suspend"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Account Balance" value={formatKyat(user.balance)} icon={Wallet} />
          <DashboardCard
            title="Total Deposited"
            value={formatKyat(user.totalDeposited)}
            icon={ShoppingBag}
          />
          <DashboardCard title="Total Spent" value={formatKyat(user.totalSpent)} icon={History} />
          <DashboardCard
            title="Subscription"
            value={
              user.isSubscribed && user.subscriptionExpiresAt
                ? `Active · exp. ${format(new Date(user.subscriptionExpiresAt), "MMM d, yyyy")}`
                : "Not subscribed"
            }
            icon={Clapperboard}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="glass-card border-white/[0.08]">
            <CardHeader>
              <CardTitle>Watch History</CardTitle>
            </CardHeader>
            <CardContent>
              <WatchHistoryList entries={watchHistory.items} />
            </CardContent>
          </Card>
          <Card className="glass-card border-white/[0.08]">
            <CardHeader>
              <CardTitle>Purchased Movies</CardTitle>
            </CardHeader>
            <CardContent>
              <PurchaseHistoryList entries={purchases.items} />
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-white/[0.08]">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactionsTable transactions={transactions.items} />
          </CardContent>
        </Card>
      </div>

      <EditRoleDialog
        user={user}
        open={editRoleOpen}
        onOpenChange={setEditRoleOpen}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={currentStatus === "SUSPENDED" ? "Reactivate this user?" : "Suspend this user?"}
        description={
          currentStatus === "SUSPENDED"
            ? `${user.name} will regain access to their account.`
            : `${user.name} will lose access to their account until reactivated.`
        }
        confirmLabel={currentStatus === "SUSPENDED" ? "Reactivate" : "Suspend"}
        variant={currentStatus === "SUSPENDED" ? "default" : "destructive"}
        loading={suspending}
        onConfirm={handleToggleSuspend}
      />
    </div>
  );
}
