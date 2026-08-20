"use client";

import { format } from "date-fns";
import { ArrowDownToLine } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatKyat, formatSignedKyat } from "@/lib/currency";
import { useLanguage } from "@/lib/context/language-context";
import type { Deposit, DepositStatus } from "@/types/deposit";

const STATUS_TONE: Record<DepositStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/** Read-only deposit history for one user — the source documents behind the wallet ledger. */
export function UserDepositsTable({ deposits }: { deposits: Deposit[] }) {
  const { t } = useLanguage();
  const copy = t.users.depositsTable;

  if (!deposits.length) {
    return (
      <EmptyState
        icon={ArrowDownToLine}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{copy.date}</TableHead>
          <TableHead>{copy.amount}</TableHead>
          <TableHead>{copy.method}</TableHead>
          <TableHead>{copy.reference}</TableHead>
          <TableHead>{copy.walletBalance}</TableHead>
          <TableHead>{copy.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deposits.map((deposit) => (
          <TableRow key={deposit.id}>
            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
              {format(new Date(deposit.createdAt), "d MMM yyyy, HH:mm:ss")}
            </TableCell>
            <TableCell className="text-sm font-semibold tabular-nums text-income">
              {formatSignedKyat(deposit.amount, "in")}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm">{deposit.paymentMethod}</span>
                {/* Which of OUR accounts the money landed in — the short catalog
                    subname ("K1") when picked, the hand-typed name otherwise. */}
                {(deposit.receivingAccountSubname || deposit.receivingAccountName) && (
                  <span className="text-xs text-muted-foreground">
                    → {deposit.receivingAccountSubname ?? deposit.receivingAccountName}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {deposit.reference}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              {deposit.walletBalanceBefore !== null && deposit.walletBalanceAfter !== null ? (
                <>
                  {formatKyat(deposit.walletBalanceBefore)}
                  <span className="mx-1">→</span>
                  {formatKyat(deposit.walletBalanceAfter)}
                </>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <StatusBadge label={deposit.status} tone={STATUS_TONE[deposit.status]} />
                {deposit.status === "REJECTED" && deposit.rejectionReason && (
                  <span
                    className="max-w-48 truncate text-xs text-muted-foreground"
                    title={deposit.rejectionReason}
                  >
                    {deposit.rejectionReason}
                  </span>
                )}
                {deposit.status !== "PENDING" && deposit.approvedAt && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {t.deposits.columns.processedAt(
                      format(new Date(deposit.approvedAt), "d MMM yyyy, HH:mm:ss")
                    )}
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
