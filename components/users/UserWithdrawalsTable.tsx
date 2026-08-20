"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatSignedKyat } from "@/lib/currency";
import { useLanguage } from "@/lib/context/language-context";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";

const STATUS_TONE: Record<WithdrawalStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/** Read-only withdrawal history for one user — payout accounts, transfer snapshots, statuses. */
export function UserWithdrawalsTable({ withdrawals }: { withdrawals: Withdrawal[] }) {
  const { t } = useLanguage();
  const copy = t.users.withdrawalsTable;

  if (!withdrawals.length) {
    return (
      <EmptyState
        icon={ArrowUpFromLine}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    );
  }

  // Distinct payout numbers, in first-seen order. Each links into the
  // relationship graph, whose link key is exactly these numbers.
  const payoutNumbers = Array.from(new Set(withdrawals.map((w) => w.accountNumber)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {copy.payoutNumbersLabel}
        </span>
        {payoutNumbers.map((number) => (
          <Link key={number} href={`/users/relationships?phone=${encodeURIComponent(number)}`}>
            <Badge
              variant="outline"
              className="font-mono text-xs transition-colors hover:bg-secondary/60"
            >
              {number}
            </Badge>
          </Link>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{copy.date}</TableHead>
            <TableHead>{copy.amount}</TableHead>
            <TableHead>{copy.payoutAccount}</TableHead>
            <TableHead>{copy.transferAccount}</TableHead>
            <TableHead>{copy.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((withdrawal) => (
            <TableRow key={withdrawal.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {format(new Date(withdrawal.createdAt), "d MMM yyyy, HH:mm:ss")}
              </TableCell>
              <TableCell className="text-sm font-semibold tabular-nums text-outgoing">
                {formatSignedKyat(withdrawal.amount, "out")}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm">
                    {withdrawal.accountName}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({withdrawal.accountType})
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {withdrawal.accountNumber}
                  </span>
                  {/* The bank the user named on THIS request. */}
                  {withdrawal.bankName && (
                    <span className="text-xs text-muted-foreground">{withdrawal.bankName}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {withdrawal.transferAccountSubname ||
                withdrawal.transferAccountName ||
                withdrawal.transferTransactionCode ? (
                  <div className="flex flex-col">
                    {/* The account WE sent from — short catalog subname ("K1") when picked. */}
                    {(withdrawal.transferAccountSubname || withdrawal.transferAccountName) && (
                      <span className="text-sm">
                        {withdrawal.transferAccountSubname ?? withdrawal.transferAccountName}
                      </span>
                    )}
                    {withdrawal.transferTransactionCode && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {withdrawal.transferTransactionCode}
                        {withdrawal.transferTransactionTime && (
                          <span className="ml-1 font-sans">
                            · {withdrawal.transferTransactionTime}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <StatusBadge label={withdrawal.status} tone={STATUS_TONE[withdrawal.status]} />
                  {withdrawal.status === "REJECTED" && withdrawal.rejectionReason && (
                    <span
                      className="max-w-48 truncate text-xs text-muted-foreground"
                      title={withdrawal.rejectionReason}
                    >
                      {withdrawal.rejectionReason}
                    </span>
                  )}
                  {withdrawal.status !== "PENDING" && withdrawal.approvedAt && (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {t.withdrawals.columns.processedAt(
                        format(new Date(withdrawal.approvedAt), "d MMM yyyy, HH:mm:ss")
                      )}
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
