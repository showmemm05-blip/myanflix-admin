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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LevelBadge } from "@/components/levels/LevelBadge";
import { AdjustBalanceDialog } from "@/components/users/AdjustBalanceDialog";
import { EditRoleDialog } from "@/components/users/EditRoleDialog";
import { WalletAdjustmentsSection } from "@/components/users/WalletAdjustmentsSection";
import { UserRelationshipsCard } from "@/components/users/UserRelationshipsCard";
import { UserDepositsSection } from "@/components/users/UserDepositsSection";
import { UserWithdrawalsSection } from "@/components/users/UserWithdrawalsSection";
import { UserPaymentHistory } from "@/components/users/UserPaymentHistory";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { cn } from "@/lib/utils";
import { USER_STATUS_TONE as STATUS_TONE } from "@/lib/status-tones";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import { userService } from "@/services/api/userService";
import { levelService } from "@/services/api/levelService";
import { paymentService } from "@/services/api/paymentService";
import { depositService } from "@/services/api/depositService";
import { withdrawalService } from "@/services/api/withdrawalService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type { UserStatus } from "@/types/user";
import { toast } from "sonner";

/**
 * How many deposit/withdrawal source documents we pull for the finance
 * region. When a user has more, the summary says exactly how much it covers
 * instead of pretending the numbers are complete.
 */
const FINANCE_FETCH_LIMIT = 100;

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
      const [user, levelStatus, transactions, deposits, withdrawals] = await Promise.all([
        userService.getUserById(id),
        // Membership standing. USERS.VIEW-gated — someone reading their own
        // profile without it gets null and the level card simply doesn't
        // render, same contract as the finance region below.
        levelService.getUserLevel(id).catch(() => null),
        // Same window as the deposit/withdrawal fetches: the default 20 made
        // the unified history interleave months of deposits with only the
        // newest handful of purchases — a chronology that quietly lied.
        paymentService.getTransactionsByUser(id, { limit: FINANCE_FETCH_LIMIT }),
        // The source documents behind the wallet ledger. Both endpoints are
        // admin-only (DEPOSIT/WITHDRAWAL_MANAGE) — a viewer without them
        // (e.g. someone on their own profile) gets null and the finance
        // region simply doesn't render, leaving the rest of the page intact.
        depositService.getAll({ userId: id, limit: FINANCE_FETCH_LIMIT }).catch(() => null),
        withdrawalService.getAll({ userId: id, limit: FINANCE_FETCH_LIMIT }).catch(() => null),
      ]);
      return { user, levelStatus, transactions, deposits, withdrawals };
    },
    [id]
  );

  // Method types + our payment accounts, exactly as the main deposit and
  // withdrawal queues fetch them — the reused column factories need them for
  // the receiving/transfer-account cells. A refused fetch (viewer without the
  // relevant permission) leaves `data` null and the columns get empty arrays,
  // the same shape the main pages render while these are still loading.
  const { data: paymentAccountTypes } = useAsyncData(() => paymentAccountService.getTypes(), []);
  const { data: paymentAccounts } = useAsyncData(() => paymentAccountService.getAccounts(), []);

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
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
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

  const { user, levelStatus, transactions, deposits, withdrawals } = data;
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

      <div className="flex flex-col gap-4">
        {/* Who this is, in one row: identity, membership standing and the
        relationship network side by side at xl so the first screen answers
        "who is this account" without scrolling. Each card degrades away on
        its own (refused level/relationship fetches), and the identity card
        widens into the freed column when the level card is gone. */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card size="sm" className={cn("glass-card", !levelStatus && "lg:col-span-2 xl:col-span-2")}>
            <CardContent className="flex h-full flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <Avatar className="size-14 shrink-0 border border-border">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-base font-semibold">{user.name}</p>
                    <RoleBadge role={user.role} />
                    <StatusBadge label={STATUS_LABELS[currentStatus]} tone={STATUS_TONE[currentStatus]} />
                  </div>
                  {/* The heading is the name the user chose; this is the login
                  identity behind it, so a display name can never hide which
                  account is on screen. */}
                  <p className="truncate text-sm text-muted-foreground">
                    @{user.username}
                    {user.phone && <> · {formatLocalPhone(user.phone)}</>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.users.profile.joinedOn(format(new Date(user.joinDate), "d MMM yyyy"))}
                  </p>
                </div>
              </div>
              {!isOwnProfile && (canEditRole || canSuspend) && (
                <div className="flex flex-wrap gap-2">
                  {canEditRole && (
                    <Button size="sm" variant="outline" onClick={() => setEditRoleOpen(true)}>
                      <ShieldCheck className="size-4" />
                      {t.users.columns.editRole}
                    </Button>
                  )}
                  {canSuspend && (
                    <Button
                      size="sm"
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

          {/* Membership standing — sits with the identity region because it
          is who the user is, not a finance ledger. `levelStatus` itself is
          never null from the API (only its `level` field can be); null here
          means the fetch was refused, so the card stays out of the way. */}
          {levelStatus && (
            <Card size="sm" className="glass-card">
              <CardContent className="flex h-full flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  {/* No held level -> the badge's own neutral-gray fallback
                  shield, deliberately unranked-looking. */}
                  <LevelBadge
                    icon={levelStatus.level?.icon ?? "shield"}
                    color={levelStatus.level?.color ?? "#8B909A"}
                    size={40}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.users.levelCard.title}
                    </p>
                    <p className="truncate font-heading text-xl font-bold tracking-tight">
                      {levelStatus.level ? levelStatus.level.name : t.users.levelCard.noLevel}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t.users.levelCard.qualifyingTotal(formatKyat(levelStatus.qualifyingTotal))}
                </p>
                {levelStatus.nextLevel ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-muted-foreground">
                          {t.users.levelCard.nextLevel}
                        </span>
                        <LevelBadge
                          icon={levelStatus.nextLevel.icon}
                          color={levelStatus.nextLevel.color}
                          size={16}
                        />
                        <span className="truncate font-medium">{levelStatus.nextLevel.name}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {levelStatus.progressPercent}%
                      </span>
                    </div>
                    <Progress value={levelStatus.progressPercent} />
                    {levelStatus.remaining !== null && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t.users.levelCard.remainingTo(
                          formatKyat(levelStatus.remaining),
                          levelStatus.nextLevel.name
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {levelStatus.level ? t.users.levelCard.topLevel : t.users.levelCard.allDisabled}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Which OTHER accounts share this user's numbers — the same
          network walk as /users/relationships, summarized. Handles its own
          fetch and degradation (see the component). */}
          <UserRelationshipsCard
            userId={user.id}
            phone={user.phone}
            className="lg:col-span-2 xl:col-span-1"
          />
        </div>

        {/* Every headline number in ONE strip — profile stats and the
        finance summary together, 5-up at xl, so nothing pushes the source
        tables below out of reach. The finance tiles keep their permission
        contract: no DEPOSIT/WITHDRAWAL_MANAGE, no tiles. */}
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              className="h-full"
            />
            <DashboardCard
              title={t.dashboard.totalSpent}
              value={formatKyat(user.totalSpent)}
              icon={History}
              iconClassName="bg-outgoing/15 text-outgoing"
              className="h-full"
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
              className="h-full"
            />
            {finance && (
              <>
                <DashboardCard
                  title={t.users.financeSummary.totalWithdrawn}
                  value={formatKyat(finance.approvedWithdrawn)}
                  icon={ArrowUpFromLine}
                  iconClassName="bg-outgoing/15 text-outgoing"
                  className="h-full"
                />
                <DashboardCard
                  title={t.users.financeSummary.pendingDeposits}
                  value={t.users.financeSummary.countAndAmount(
                    finance.pendingDepositCount,
                    formatKyat(finance.pendingDepositAmount)
                  )}
                  icon={Hourglass}
                  iconClassName="bg-warning/15 text-warning"
                  className="h-full"
                />
                <DashboardCard
                  title={t.users.financeSummary.pendingWithdrawals}
                  value={t.users.financeSummary.countAndAmount(
                    finance.pendingWithdrawalCount,
                    formatKyat(finance.pendingWithdrawalAmount)
                  )}
                  icon={Clock}
                  iconClassName="bg-warning/15 text-warning"
                  className="h-full"
                />
                <DashboardCard
                  title={t.users.financeSummary.rejected}
                  value={t.users.financeSummary.rejectedValue(
                    finance.rejectedDeposits,
                    finance.rejectedWithdrawals
                  )}
                  icon={XCircle}
                  iconClassName="bg-destructive/15 text-destructive"
                  className="h-full"
                />
                {/* Server-computed total deposited minus approved withdrawals from the list. */}
                <DashboardCard
                  title={t.users.financeSummary.netFlow}
                  value={formatKyat(user.totalDeposited - finance.approvedWithdrawn)}
                  icon={Scale}
                  iconClassName="bg-info/15 text-info"
                  className="h-full"
                />
              </>
            )}
          </div>
          {finance && finance.total > finance.shown && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t.users.financeSummary.partialNote(finance.shown, finance.total)}
            </p>
          )}
        </div>

        {/* The unified payment history FIRST: one chronological ledger built
        from the transactions plus the full deposit/withdrawal source rows
        (shadow DEPOSIT/WITHDRAWAL transaction rows deduplicated inside the
        component). It renders even when the deposit/withdrawal fetches were
        refused — it then covers less and says so. */}
        <UserPaymentHistory
          transactions={transactions.items}
          transactionsTotal={transactions.total}
          deposits={deposits?.items ?? null}
          withdrawals={withdrawals?.items ?? null}
        />

        {finance && deposits && withdrawals && (
          <>

            {/* The exact tables from /deposits and /withdrawals — same
            column factories, dialogs and permission gates — so this page can
            never drift from the main queues. `onChanged` refetches the whole
            profile: balance, finance summary, level card and transactions
            all reflect an approve/reject made from here. */}
            <UserDepositsSection
              deposits={deposits.items}
              types={paymentAccountTypes ?? []}
              paymentAccounts={paymentAccounts ?? []}
              onChanged={refetch}
            />

            <UserWithdrawalsSection
              withdrawals={withdrawals.items}
              types={paymentAccountTypes ?? []}
              paymentAccounts={paymentAccounts ?? []}
              onChanged={refetch}
            />
          </>
        )}

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
