"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BankMatchBadge } from "@/components/shared/BankMatchBadge";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReceivingAccountCell } from "@/components/deposits/ReceivingAccountCell";
import { UserDepositAccountCell } from "@/components/deposits/UserDepositAccountCell";
import { formatSignedKyat } from "@/lib/currency";
import { toDepositVerification, viewMatchStatus, viewRiskLevel, viewRiskReasons } from "@/lib/bank-verification";
import { REVIEW_STATUS_TONE as STATUS_TONE } from "@/lib/status-tones";
import { formatLocalPhone } from "@/lib/phone";
import { matchesUserSearch } from "@/lib/user-search";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Deposit } from "@/types/deposit";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

export function getDepositColumns({
  t,
  types,
  paymentAccounts,
  canApprove,
  canReject,
  onApprove,
  onReject,
  onReceivingSaved,
  onOpenVerification,
  approvingId,
  now,
}: {
  t: TranslationShape;
  types: PaymentAccountType[];
  paymentAccounts: PaymentAccount[];
  /** DEPOSITS.APPROVE. */
  canApprove: boolean;
  /** DEPOSITS.REJECT — a separate permission, so the two buttons gate apart. */
  canReject: boolean;
  onApprove: (deposit: Deposit) => void;
  onReject: (deposit: Deposit) => void;
  onReceivingSaved: (deposit: Deposit) => void;
  /**
   * Opens the Verification Details modal for the row — both new columns are
   * click targets. Omitted where no modal is mounted (the user profile's
   * deposits card), in which case the badges render as plain text.
   */
  onOpenVerification?: (deposit: Deposit) => void;
  approvingId?: string | null;
  /**
   * The page's `useNow()` clock for the read-time NO_BANK_TRANSACTION
   * derivation. Optional for callers that don't tick (the user profile
   * card): they get the moment the columns were built.
   */
  now?: number;
}): ColumnDef<Deposit>[] {
  const clock = now ?? Date.now();
  const VerificationCell = ({ deposit, children }: { deposit: Deposit; children: React.ReactNode }) =>
    onOpenVerification ? (
      <button
        type="button"
        className="flex flex-col items-start gap-1 rounded-md text-left hover:bg-accent/50"
        onClick={() => onOpenVerification(deposit)}
        aria-label={t.verification.modal.openAriaLabel}
      >
        {children}
      </button>
    ) : (
      <div className="flex flex-col items-start gap-1">{children}</div>
    );

  return [
    {
      accessorKey: "userName",
      header: t.deposits.columns.customer,
      // The cell shows the label and the phone, and the row also carries the
      // raw login identity — the search box matches all three, so an account
      // stays findable by whichever one the admin has in hand.
      filterFn: (row, _columnId, value) =>
        matchesUserSearch(String(value), {
          name: row.original.userName,
          username: row.original.userUsername,
          phone: row.original.userPhone,
          email: row.original.userEmail,
        }),
      cell: ({ row }) => (
        <div className="flex max-w-40 flex-col">
          <span className="truncate text-sm font-medium">{row.original.userName}</span>
          {/* Phone when the account has one; e-mail for accounts without
              (Google sign-ins); a dash only when it has neither. */}
          <span
            className="truncate text-xs tabular-nums text-muted-foreground"
            title={formatLocalPhone(row.original.userPhone) ?? row.original.userEmail ?? undefined}
          >
            {formatLocalPhone(row.original.userPhone) ?? row.original.userEmail ?? "—"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: t.deposits.columns.amount,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-income">
          <ArrowDownLeft className="size-3.5 shrink-0 text-income" />
          {formatSignedKyat(row.original.amount, "in")}
        </span>
      ),
    },
    {
      id: "receivingAccount",
      header: t.deposits.columns.receivingAccount,
      cell: ({ row }) => (
        <ReceivingAccountCell
          deposit={row.original}
          accounts={paymentAccounts}
          types={types}
          onSaved={onReceivingSaved}
        />
      ),
    },
    {
      accessorKey: "reference",
      header: t.deposits.columns.reference,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.reference}</span>,
    },
    {
      accessorKey: "createdAt",
      header: t.deposits.columns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.deposits.columns.status,
      cell: ({ row }) => {
        const deposit = row.original;
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={deposit.status} tone={STATUS_TONE[deposit.status]} />
            {deposit.status === "REJECTED" && deposit.rejectionReason && (
              <span className="max-w-48 truncate text-xs text-muted-foreground" title={deposit.rejectionReason}>
                {deposit.rejectionReason}
              </span>
            )}
            {deposit.status !== "PENDING" && deposit.approvedAt && (
              <span className="text-xs text-muted-foreground">
                {t.deposits.columns.processedAt(format(new Date(deposit.approvedAt), "d MMM yyyy, HH:mm:ss"))}
              </span>
            )}
          </div>
        );
      },
    },
    {
      // The bank side: what the phone-monitor saw, matched onto this row.
      // NO_BANK_TRANSACTION is derived at render time (viewMatchStatus), so
      // a row crossing the 24 h line flips without any fetch.
      id: "bankMatch",
      accessorFn: (row) => row.matchStatus,
      header: t.verification.columns.bankMatch,
      cell: ({ row }) => {
        const record = toDepositVerification(row.original);
        const status = viewMatchStatus(record, clock);
        return (
          <VerificationCell deposit={row.original}>
            <BankMatchBadge status={status} />
            <span className="text-xs text-muted-foreground">
              {record.bankCheckedAt
                ? format(new Date(record.bankCheckedAt), "d MMM yyyy, HH:mm:ss")
                : status === "UNVERIFIED"
                  ? t.verification.modal.waitingForBank
                  : null}
            </span>
          </VerificationCell>
        );
      },
    },
    {
      id: "risk",
      accessorFn: (row) => row.riskLevel ?? "",
      header: t.verification.columns.risk,
      cell: ({ row }) => {
        const record = toDepositVerification(row.original);
        return (
          <VerificationCell deposit={row.original}>
            <RiskBadge level={viewRiskLevel(record, clock)} reasons={viewRiskReasons(record, clock)} />
          </VerificationCell>
        );
      },
    },
    {
      id: "actions",
      header: t.deposits.columns.actions,
      cell: ({ row }) => {
        const deposit = row.original;
        if (deposit.status !== "PENDING" || (!canApprove && !canReject)) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const isApproving = approvingId === deposit.id;
        return (
          <div className="flex items-center gap-2">
            {canApprove && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={isApproving}
                onClick={() => onApprove(deposit)}
              >
                {isApproving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5 text-success" />
                )}
                {t.common.approve}
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="outline" className="gap-1" disabled={isApproving} onClick={() => onReject(deposit)}>
                <X className="size-3.5 text-destructive" />
                {t.common.reject}
              </Button>
            )}
          </div>
        );
      },
    },
    {
      id: "userDepositAccount",
      header: t.deposits.columns.userDepositAccount,
      cell: ({ row }) => (
        <UserDepositAccountCell
          deposit={row.original}
          accounts={paymentAccounts}
          types={types}
          onSaved={onReceivingSaved}
        />
      ),
    },
  ];
}
