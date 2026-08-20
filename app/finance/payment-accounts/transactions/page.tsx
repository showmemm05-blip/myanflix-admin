"use client";

import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
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

function AllTransactionsContent() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<TransactionFilterValues>(EMPTY_TRANSACTION_FILTERS);
  const [detailsTarget, setDetailsTarget] = useState<PaymentAccountTransaction | null>(null);

  const { data: accounts } = useAsyncData(() => paymentAccountService.getAccounts(), []);
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      paymentAccountService.getAllTransactions({
        limit: 100,
        paymentAccountId: filters.paymentAccountId || undefined,
        type: (filters.type || undefined) as PaymentAccountTransactionType | undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
        amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
      }),
    [filters],
  );

  const transactions = data?.items ?? [];
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
        <TransactionFilters accounts={accounts ?? []} value={filters} onChange={setFilters} t={t} />
      </div>

      {!isLoading && transactions.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title={t.paymentAccountLedger.central.emptyTitle}
          description={t.paymentAccountLedger.central.emptyDescription}
        />
      ) : (
        <DataTable
          columns={columns}
          data={transactions}
          isLoading={isLoading}
          rowClassName={getPaymentAccountTransactionRowClass}
        />
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
