"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ListTree, Wallet } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequireRole } from "@/components/shared/RequireRole";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/DataTable";
import { getPaymentAccountLedgerColumns } from "@/components/payment-accounts/LedgerColumns";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket } from "@/lib/socket";

function PaymentAccountsLedgerListContent() {
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(
    () => paymentAccountService.getAccounts(),
    [],
  );
  /** Only used for the payment-method logos in the account column. */
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    // Minimal {paymentAccountId} signal — every balance/ledger change on any
    // account (manual entry, deposit/withdrawal link/relink) just triggers a
    // refetch of the list rather than trying to patch one row's Decimal
    // fields client-side.
    const handleUpdated = () => refetch();
    socket.on("payment-account.updated", handleUpdated);
    return () => {
      socket.off("payment-account.updated", handleUpdated);
    };
    // refetch's identity changes every render (it's a fresh closure over
    // setReloadKey each time) but every instance does the same thing, so
    // resubscribing on each one would be pure churn — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accounts = data ?? [];
  const columns = getPaymentAccountLedgerColumns({ t, types: types ?? [] });

  if (error) {
    return (
      <div>
        <ErrorState description={t.paymentAccountLedger.list.loadError} onRetry={refetch} />
      </div>
    );
  }

  // Sits right beside the table's search input (DataTable searchActions slot).
  const allTransactionsButton = (
    <Button
      variant="outline"
      className="shrink-0"
      render={<Link href="/finance/payment-accounts/transactions" />}
      nativeButton={false}
    >
      <ListTree className="size-4" />
      {t.paymentAccountLedger.list.allTransactionsLink}
    </Button>
  );

  return (
    <div>
      {!isLoading && accounts.length === 0 ? (
        // The table (and its search-side button) is hidden here — keep the
        // link reachable.
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">{allTransactionsButton}</div>
          <EmptyState
            icon={Wallet}
            title={t.paymentAccountLedger.list.emptyTitle}
            description={t.paymentAccountLedger.list.emptyDescription}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={accounts}
          isLoading={isLoading}
          searchKey="accountName"
          searchPlaceholder={t.paymentAccountLedger.list.searchPlaceholder}
          searchActions={allTransactionsButton}
        />
      )}
    </div>
  );
}

export default function PaymentAccountsLedgerListPage() {
  const { t } = useLanguage();
  return (
    <RequireRole
      allow={["SUPER_ADMIN"]}
      title={t.paymentAccountLedger.list.title}
      description={t.paymentAccountLedger.list.description}
    >
      <PaymentAccountsLedgerListContent />
    </RequireRole>
  );
}
