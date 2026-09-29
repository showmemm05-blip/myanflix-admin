"use client";

import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import {
  getPaymentAccountTransactionColumns,
  getPaymentAccountTransactionRowClass,
} from "@/components/payment-accounts/TransactionColumns";
import { TransactionDetailsDialog } from "@/components/payment-accounts/TransactionDetailsDialog";
import {
  TransactionFilters,
  EMPTY_TRANSACTION_FILTERS,
  type TransactionFilterValues,
} from "@/components/payment-accounts/TransactionFilters";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket } from "@/lib/socket";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type {
  PaymentAccountTransaction,
  PaymentAccountTransactionType,
} from "@/types/payment-account-transaction";

/** Rows per server page (H-24): the cross-account ledger only grows, so it is paged on the server. */
const PAGE_LIMIT = 25;

function AllTransactionsContent() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<TransactionFilterValues>(EMPTY_TRANSACTION_FILTERS);
  const [page, setPage] = useState(1);
  // Any filter change restarts at page 1 — page N of a narrower result set
  // is usually past its end.
  const handleFiltersChange = (next: TransactionFilterValues) => {
    setFilters(next);
    setPage(1);
  };
  const [detailsTarget, setDetailsTarget] = useState<PaymentAccountTransaction | null>(null);

  const { data: accounts } = useAsyncData(() => paymentAccountService.getAccounts(), []);
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      paymentAccountService.getAllTransactions({
        page,
        limit: PAGE_LIMIT,
        paymentAccountId: filters.paymentAccountId || undefined,
        type: (filters.type || undefined) as PaymentAccountTransactionType | undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
        amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
      }),
    [filters, page],
  );

  const transactions = data?.items ?? [];
  const total = data?.total ?? 0;
  const isFiltered = Object.values(filters).some(Boolean);
  const columns = getPaymentAccountTransactionColumns({
    t,
    types: types ?? [],
    showAccount: true,
    onViewDetails: setDetailsTarget,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    // This is the cross-account view, so any account's change is relevant —
    // no id filtering, just refetch under the current filters.
    const handleUpdated = () => refetch();
    socket.on("payment-account.updated", handleUpdated);
    return () => {
      socket.off("payment-account.updated", handleUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title={t.paymentAccountLedger.central.title} description={t.paymentAccountLedger.central.description} />
        <ErrorState description={t.paymentAccountLedger.central.loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.paymentAccountLedger.central.title} description={t.paymentAccountLedger.central.description} />

      <div className="mb-4">
        <TransactionFilters accounts={accounts ?? []} value={filters} onChange={handleFiltersChange} t={t} />
      </div>

      {!isLoading && total === 0 && !isFiltered ? (
        <EmptyState
          icon={ListTree}
          title={t.paymentAccountLedger.central.emptyTitle}
          description={t.paymentAccountLedger.central.emptyDescription}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={transactions}
            isLoading={isLoading}
            pageSize={PAGE_LIMIT}
            manualPagination
            rowClassName={getPaymentAccountTransactionRowClass}
          />
          {!isLoading && (
            <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={setPage} />
          )}
        </>
      )}

      <TransactionDetailsDialog
        transaction={detailsTarget}
        open={detailsTarget !== null}
        onOpenChange={(open) => !open && setDetailsTarget(null)}
      />
    </div>
  );
}

export default function AllPaymentAccountTransactionsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="PAYMENT_ACCOUNTS.LEDGER_MANAGE"
      title={t.paymentAccountLedger.central.title}
      description={t.paymentAccountLedger.central.description}
    >
      <AllTransactionsContent />
    </RequirePermission>
  );
}
