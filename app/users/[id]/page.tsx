"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowUpFromLine,
  Ban,
  CheckCircle2,
  Clapperboard,
  Clock,
  Coins,
  History,
  Hourglass,
  Scale,
  ShieldCheck,
  ShoppingBag,
  UserX,
  Wallet,
  XCircle,
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
import { UserDepositsTable } from "@/components/users/UserDepositsTable";
import { UserWithdrawalsTable } from "@/components/users/UserWithdrawalsTable";
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
import { depositService } from "@/services/api/depositService";
import { withdrawalService } from "@/services/api/withdrawalService";
import type { UserStatus } from "@/types/user";
import { toast } from "sonner";

/**
 * How many deposit/withdrawal source documents we pull for the finance
 * region. When a user has more, the summary says exactly how much it covers
 * instead of pretending the numbers are complete.
 */
const FINANCE_FETCH_LIMIT = 100;

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, currentUser, can } = useRole();
  const { t } = useLanguage();
  // Reading someone else's profile is USERS.VIEW; your own is always yours.
  const canViewOthers = can("USERS.VIEW");
  const canEditRole = can("USERS.EDIT");
  const canSuspend = can("USERS.SUSPEND");
  const canAdjustWallet = can("USERS.WALLET_ADJUST");
  const isOwnProfile = currentUser.id === id;
  const STATUS_LABELS: Record<UserStatus, string> = {
    ACTIVE: t.common.active,
    SUSPENDED: t.users.profile.statusSuspended,
    BANNED: t.users.profile.statusBanned,
  };

  const { data, isLoading, error, refetch } = useAsyncData(
    async () => {
      const [user, watchHistory, transactions, deposits, withdrawals] = await Promise.all([
        userService.getUserById(id),
        userService.getWatchHistory(id),
        paymentService.getTransactionsByUser(id),
        // The source documents behind the wallet ledger. Both endpoints are
        // admin-only (DEPOSIT/WITHDRAWAL_MANAGE) — a viewer without them
        // (e.g. someone on their own profile) gets null and the finance
        // region simply doesn't render, leaving the rest of the page intact.
        depositService.getAll({ userId: id, limit: FINANCE_FETCH_LIMIT }).catch(() => null),
        withdrawalService.getAll({ userId: id, limit: FINANCE_FETCH_LIMIT }).catch(() => null),
      ]);
      return { user, watchHistory, transactions, deposits, withdrawals };
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

  if (!canViewOthers && !isOwnProfile) {
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

  const { user, watchHistory, transactions, deposits, withdrawals } = data;
  const currentStatus = status ?? user.status;

  // Finance summary, computed from the fetched source documents. Total
  // deposited comes server-computed on the user; withdrawn/pending/rejected
  // figures come from the lists above and are capped by FINANCE_FETCH_LIMIT.
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const finance =
    deposits && withdrawals
      ? (() => {
          const pendingDeposits = deposits.items.filter((d) => d.status === "PENDING");
          const pendingWithdrawals = withdrawals.items.filter((w) => w.status === "PENDING");
          return {
            approvedWithdrawn: sum(
              withdrawals.items.filter((w) => w.status === "APPROVED").map((w) => w.amount)
            ),
            pendingDepositCount: pendingDeposits.length,
            pendingDepositAmount: sum(pendingDeposits.map((d) => d.amount)),
            pendingWithdrawalCount: pendingWithdrawals.length,
            pendingWithdrawalAmount: sum(pendingWithdrawals.map((w) => w.amount)),
            rejectedDeposits: deposits.items.filter((d) => d.status === "REJECTED").length,
            rejectedWithdrawals: withdrawals.items.filter((w) => w.status === "REJECTED").length,
            shown: deposits.items.length + withdrawals.items.length,
            total: deposits.total + withdrawals.total,
          };
        })()
      : null;

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
                {/* The heading is the name the user chose; this is the login
                identity behind it, so a display name can never hide which
                account is on screen. */}
                <p className="text-sm text-muted-foreground">@{user.username}</p>
                {user.phone && (
                  <p className="text-sm text-muted-foreground">{formatLocalPhone(user.phone)}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.users.profile.joinedOn(format(new Date(user.joinDate), "d MMM yyyy"))}
                </p>
              </div>
            </div>
            {!isOwnProfile && (canEditRole || canSuspend) && (
              <div className="flex gap-2">
                {canEditRole && (
                  <Button variant="outline" onClick={() => setEditRoleOpen(true)}>
                    <ShieldCheck className="size-4" />
                    {t.users.columns.editRole}
                  </Button>
                )}
                {canSuspend && (
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
                )}
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
              // Extra bottom padding reserves room for the wallet-adjust
              // button pinned to the card's bottom-left corner.
              className={canAdjustWallet ? "h-full pb-9" : "h-full"}
            />
            {canAdjustWallet && (
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

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.users.profile.watchHistoryTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <WatchHistoryList entries={watchHistory.items} />
          </CardContent>
        </Card>

        {finance && deposits && withdrawals && (
          <>
            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <DashboardCard
                  title={t.users.financeSummary.totalWithdrawn}
                  value={formatKyat(finance.approvedWithdrawn)}
                  icon={ArrowUpFromLine}
                  iconClassName="bg-outgoing/15 text-outgoing"
                />
                <DashboardCard
                  title={t.users.financeSummary.pendingDeposits}
                  value={t.users.financeSummary.countAndAmount(
                    finance.pendingDepositCount,
                    formatKyat(finance.pendingDepositAmount)
                  )}
                  icon={Hourglass}
                  iconClassName="bg-warning/15 text-warning"
                />
                <DashboardCard
                  title={t.users.financeSummary.pendingWithdrawals}
                  value={t.users.financeSummary.countAndAmount(
                    finance.pendingWithdrawalCount,
                    formatKyat(finance.pendingWithdrawalAmount)
                  )}
                  icon={Clock}
                  iconClassName="bg-warning/15 text-warning"
                />
                <DashboardCard
                  title={t.users.financeSummary.rejected}
                  value={t.users.financeSummary.rejectedValue(
                    finance.rejectedDeposits,
                    finance.rejectedWithdrawals
                  )}
                  icon={XCircle}
                  iconClassName="bg-destructive/15 text-destructive"
                />
                {/* Server-computed total deposited minus approved withdrawals from the list. */}
                <DashboardCard
                  title={t.users.financeSummary.netFlow}
                  value={formatKyat(user.totalDeposited - finance.approvedWithdrawn)}
                  icon={Scale}
                  iconClassName="bg-info/15 text-info"
                />
              </div>
              {finance.total > finance.shown && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.users.financeSummary.partialNote(finance.shown, finance.total)}
                </p>
              )}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t.users.depositsTable.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <UserDepositsTable deposits={deposits.items} />
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t.users.withdrawalsTable.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <UserWithdrawalsTable withdrawals={withdrawals.items} />
              </CardContent>
            </Card>
          </>
        )}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.users.profile.paymentHistoryTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactionsTable transactions={transactions.items} />
          </CardContent>
        </Card>

        {canAdjustWallet && (
          <WalletAdjustmentsSection userId={user.id} refreshKey={adjustmentsVersion} />
        )}
      </div>

      <EditRoleDialog
        user={user}
        open={editRoleOpen}
        onOpenChange={setEditRoleOpen}
        onSaved={() => refetch()}
      />

      {canAdjustWallet && (
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
