"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import {
  getPaymentAccountTransactionColumns,
  getPaymentAccountTransactionRowClass,
} from "@/components/payment-accounts/TransactionColumns";
import { TransactionDetailsDialog } from "@/components/payment-accounts/TransactionDetailsDialog";
import { RecordTransactionDialog } from "@/components/payment-accounts/RecordTransactionDialog";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { formatKyat } from "@/lib/currency";
import { getSocket } from "@/lib/socket";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type { PaymentAccountTransaction } from "@/types/payment-account-transaction";

/** History rows per server page (H-24): the ledger only grows, so it is paged on the server. */
const PAGE_LIMIT = 25;

function PaymentAccountDetailContent({ id }: { id: string }) {
  const { t } = useLanguage();
  const { can } = useRole();
  // Recording money in/out writes a ledger entry — LEDGER_MANAGE, not the
  // plain VIEW that gets you onto this page.
  const canRecordEntry = can("PAYMENT_ACCOUNTS.LEDGER_MANAGE");
  const [page, setPage] = useState(1);
  // The account (cards) and its history (paged) load separately, so turning
  // a history page never blanks the balance cards.
  const {
    data: account,
    isLoading: accountLoading,
    error: accountError,
    refetch: refetchAccount,
  } = useAsyncData(() => paymentAccountService.getAccount(id), [id]);
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useAsyncData(
    () => paymentAccountService.getTransactions(id, { page, limit: PAGE_LIMIT }),
    [id, page],
  );
  const error = accountError ?? historyError;
  const refetch = () => {
    refetchAccount();
    refetchHistory();
  };

  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);

  const [dialogMode, setDialogMode] = useState<"add" | "remove" | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<PaymentAccountTransaction | null>(null);

  const transactions = history?.items ?? [];
  const columns = getPaymentAccountTransactionColumns({
    t,
    types: types ?? [],
    onViewDetails: setDetailsTarget,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleUpdated = (payload: { paymentAccountId: string }) => {
      if (payload.paymentAccountId !== id) return;
      refetchAccount();
      refetchHistory();
    };
    socket.on("payment-account.updated", handleUpdated);
    return () => {
      socket.off("payment-account.updated", handleUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div>
        <PageHeader title={t.paymentAccountLedger.detail.notFound} />
        <ErrorState description={t.paymentAccountLedger.detail.loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" render={<Link href="/finance/payment-accounts" />} nativeButton={false}>
        <ArrowLeft className="size-4" />
        {t.paymentAccountLedger.detail.backToList}
      </Button>

      <PageHeader
        title={account?.accountName ?? ""}
        description={account?.subname ?? account?.type ?? undefined}
        actions={
          account && canRecordEntry && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogMode("remove")}>
                <ArrowUpFromLine className="size-4" />
                {t.paymentAccountLedger.detail.removeMoney}
              </Button>
              <Button onClick={() => setDialogMode("add")}>
                <ArrowDownToLine className="size-4" />
                {t.paymentAccountLedger.detail.addMoney}
              </Button>
            </div>
          )
        }
      />

      {accountLoading || !account ? null : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title={t.paymentAccountLedger.detail.totalInCard}
              value={formatKyat(account.totalIn)}
              icon={ArrowDownToLine}
              iconClassName="bg-income/15 text-income"
            />
            <DashboardCard
              title={t.paymentAccountLedger.detail.totalOutCard}
              value={formatKyat(account.totalOut)}
              icon={ArrowUpFromLine}
              iconClassName="bg-outgoing/15 text-outgoing"
            />
            <DashboardCard title={t.paymentAccountLedger.detail.balanceCard} value={formatKyat(account.balance)} icon={Wallet} />
          </div>

          <h2 className="mb-1 text-lg font-semibold">{t.paymentAccountLedger.detail.historyTitle}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t.paymentAccountLedger.detail.historyDescription}</p>

          {!historyLoading && (history?.total ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t.paymentAccountLedger.detail.emptyHistoryTitle}
              description={t.paymentAccountLedger.detail.emptyHistoryDescription}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={transactions}
                isLoading={historyLoading}
                pageSize={PAGE_LIMIT}
                manualPagination
                rowClassName={getPaymentAccountTransactionRowClass}
              />
              {!historyLoading && (
                <ServerPagination
                  page={page}
                  pageSize={PAGE_LIMIT}
                  total={history?.total ?? 0}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </>
      )}

      <TransactionDetailsDialog
        transaction={detailsTarget}
        open={detailsTarget !== null}
        onOpenChange={(open) => !open && setDetailsTarget(null)}
      />

      <RecordTransactionDialog
        account={dialogMode ? account : null}
        mode={dialogMode ?? undefined}
        open={dialogMode !== null}
        onOpenChange={(o) => !o && setDialogMode(null)}
        onSaved={() => {
          // The POST response's `entry` is a deliberately lighter shape than a
          // list row — no joined account/deposit/withdrawal detail — so there's
          // nothing to optimistically splice in that the details panel could
          // actually read. Refetching gets the fully-joined row and keeps this
          // page from having to track the server's shape by hand.
          refetch();
        }}
      />
    </div>
  );
}

export default function PaymentAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  return (
    <RequirePermission permission="PAYMENT_ACCOUNTS.VIEW" title={t.paymentAccountLedger.list.title} description={t.paymentAccountLedger.list.description}>
      <PaymentAccountDetailContent id={id} />
    </RequirePermission>
  );
}
