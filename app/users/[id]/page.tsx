"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clapperboard,
  Coins,
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
import { AdjustBalanceDialog } from "@/components/users/AdjustBalanceDialog";
import { EditRoleDialog } from "@/components/users/EditRoleDialog";
import { WalletAdjustmentsSection } from "@/components/users/WalletAdjustmentsSection";
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
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import { userService } from "@/services/api/userService";
import { paymentService } from "@/services/api/paymentService";
import type { UserStatus } from "@/types/user";
import { toast } from "sonner";

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, currentUser, isSuperAdmin } = useRole();
  const { t } = useLanguage();
  const canManage = role !== "USER";
  const isOwnProfile = currentUser.id === id;
  const STATUS_LABELS: Record<UserStatus, string> = {
    ACTIVE: t.common.active,
    SUSPENDED: t.users.profile.statusSuspended,
    BANNED: t.users.profile.statusBanned,
  };

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
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Bumped after each saved adjustment so WalletAdjustmentsSection refetches.
  const [adjustmentsVersion, setAdjustmentsVersion] = useState(0);

  if (!canManage && !isOwnProfile) {
    return (
      <div>
        <PageHeader title={t.users.profile.title} />
        <AccessRestricted role={role} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t.users.profile.title} />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.user) {
    return (
      <div>
        <PageHeader title={t.users.profile.title} />
        {error ? (
          <ErrorState description={t.users.profile.loadError} onRetry={refetch} />
        ) : (
          <EmptyState
            icon={UserX}
            title={t.users.profile.notFoundTitle}
            description={t.users.profile.notFoundDescription}
            action={
              <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
                {t.users.profile.backToUsers}
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
    toast.success(nextStatus === "SUSPENDED" ? t.users.suspendedToast : t.users.reactivatedToast);
    setSuspendOpen(false);
  };

  return (
    <div>
      <PageHeader
        title={t.users.profile.title}
        actions={
          <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
            {t.users.profile.backToUsers}
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <Card className="glass-card">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border border-border">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold">{user.name}</p>
                  <RoleBadge role={user.role} />
                  <StatusBadge label={STATUS_LABELS[currentStatus]} tone={STATUS_TONE[currentStatus]} />
                </div>
                {user.phone && (
                  <p className="text-sm text-muted-foreground">{formatLocalPhone(user.phone)}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.users.profile.joinedOn(format(new Date(user.joinDate), "d MMM yyyy"))}
                </p>
              </div>
            </div>
            {canManage && !isOwnProfile && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditRoleOpen(true)}>
                  <ShieldCheck className="size-4" />
                  {t.users.columns.editRole}
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
                  {currentStatus === "SUSPENDED" ? t.users.reactivate : t.users.suspend}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <DashboardCard
              title={t.dashboard.accountBalance}
              value={formatKyat(user.balance)}
              icon={Wallet}
              // Extra bottom padding reserves room for the Super-Admin-only
              // adjust button pinned to the card's bottom-left corner.
              className={isSuperAdmin ? "h-full pb-9" : "h-full"}
            />
            {isSuperAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="absolute bottom-3 left-5 h-7 gap-1 px-2 text-xs"
                onClick={() => setAdjustOpen(true)}
              >
                <Coins className="size-3.5" />
                {t.walletAdjustments.adjustButton}
              </Button>
            )}
          </div>
          <DashboardCard
            title={t.dashboard.totalDeposited}
            value={formatKyat(user.totalDeposited)}
            icon={ShoppingBag}
            iconClassName="bg-income/15 text-income"
          />
          <DashboardCard
            title={t.dashboard.totalSpent}
            value={formatKyat(user.totalSpent)}
            icon={History}
            iconClassName="bg-outgoing/15 text-outgoing"
          />
          <DashboardCard
            title={t.dashboard.subscription}
            value={
              user.isSubscribed && user.subscriptionExpiresAt
                ? t.users.profile.subscriptionActive(format(new Date(user.subscriptionExpiresAt), "d MMM yyyy"))
                : t.dashboard.notSubscribed
            }
            icon={Clapperboard}
            iconClassName="bg-chart-5/15 text-chart-5"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.users.profile.watchHistoryTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <WatchHistoryList entries={watchHistory.items} />
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.dashboard.purchasedMovies}</CardTitle>
            </CardHeader>
            <CardContent>
              <PurchaseHistoryList entries={purchases.items} />
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.users.profile.paymentHistoryTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactionsTable transactions={transactions.items} />
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <WalletAdjustmentsSection userId={user.id} refreshKey={adjustmentsVersion} />
        )}
      </div>

      <EditRoleDialog
        user={user}
        open={editRoleOpen}
        onOpenChange={setEditRoleOpen}
        onSaved={() => refetch()}
      />

      {isSuperAdmin && (
        <AdjustBalanceDialog
          user={user}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          onSaved={() => {
            // Refresh the profile (balance card) and the adjustments list.
            refetch();
            setAdjustmentsVersion((v) => v + 1);
          }}
        />
      )}

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={currentStatus === "SUSPENDED" ? t.users.reactivateTitle : t.users.suspendTitle}
        description={
          currentStatus === "SUSPENDED"
            ? t.users.reactivateDescription(user.name)
            : t.users.suspendDescription(user.name)
        }
        confirmLabel={currentStatus === "SUSPENDED" ? t.users.reactivate : t.users.suspend}
        variant={currentStatus === "SUSPENDED" ? "default" : "destructive"}
        loading={suspending}
        onConfirm={handleToggleSuspend}
      />
    </div>
  );
}
