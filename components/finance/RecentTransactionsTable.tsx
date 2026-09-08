"use client";

import { Receipt } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { getTransactionColumns } from "@/components/finance/columns";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/lib/context/language-context";
import type { Transaction } from "@/types/transaction";

/**
 * The dashboard's recent-activity widget renders the Transactions page's
 * exact column set — ID, customer, movie, amount, type, date, status — so the
 * two surfaces can never drift apart (the same rule the user detail page
 * follows for deposits and withdrawals). The caller caps the rows, so the
 * table runs without search or a pagination footer.
 */
export function RecentTransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const { t } = useLanguage();

  return (
    <DataTable
      columns={getTransactionColumns(t)}
      data={transactions}
      hideFooter
      emptyState={
        <EmptyState
          icon={Receipt}
          title={t.finance.noTransactionsTitle}
          description={t.finance.recentTable.emptyDescription}
        />
      }
    />
  );
}
