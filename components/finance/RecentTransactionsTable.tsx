"use client";

import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Receipt } from "lucide-react";
import { formatKyat } from "@/lib/currency";
import { useLanguage } from "@/lib/context/language-context";
import type { Transaction, TransactionStatus } from "@/types/transaction";

const STATUS_TONE: Record<TransactionStatus, StatusTone> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
};

export function RecentTransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const { t } = useLanguage();

  if (!transactions.length) {
    return (
      <EmptyState
        icon={Receipt}
        title={t.finance.noTransactionsTitle}
        description={t.finance.recentTable.emptyDescription}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t.finance.recentTable.user}</TableHead>
          <TableHead>{t.finance.recentTable.movie}</TableHead>
          <TableHead>{t.finance.recentTable.amount}</TableHead>
          <TableHead>{t.finance.recentTable.date}</TableHead>
          <TableHead>{t.finance.recentTable.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarFallback>{txn.userName.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{txn.userName}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {txn.movieTitle ?? <span className="italic">—</span>}
            </TableCell>
            <TableCell
              className={`text-sm font-medium tabular-nums ${txn.amount < 0 ? "text-destructive" : ""}`}
            >
              {formatKyat(txn.amount)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(txn.createdAt), "d MMM yyyy")}
            </TableCell>
            <TableCell>
              <StatusBadge label={txn.status} tone={STATUS_TONE[txn.status]} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
