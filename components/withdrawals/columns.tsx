"use client";

import { format } from "date-fns";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Check, Eye, ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BankMatchBadge } from "@/components/shared/BankMatchBadge";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TransferAccountCell } from "@/components/withdrawals/TransferAccountCell";
import { formatSignedKyat } from "@/lib/currency";
import { toWithdrawalVerification, viewMatchStatus, viewRiskLevel, viewRiskReasons } from "@/lib/bank-verification";
import { REVIEW_STATUS_TONE as STATUS_TONE } from "@/lib/status-tones";
import { formatLocalPhone } from "@/lib/phone";
import { matchesUserSearch } from "@/lib/user-search";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Withdrawal } from "@/types/withdrawal";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

export function getWithdrawalColumns({
  t,
  types,
  paymentAccounts,
  canApprove,
  canReject,
  onView,
  onApprove,
  onReject,
  onTransferSaved,
  onOpenVerification,
  approvingId,
  now,
}: {
  t: TranslationShape;
  types: PaymentAccountType[];
  paymentAccounts: PaymentAccount[];
  /** WITHDRAWALS.APPROVE. */
  canApprove: boolean;
  /** WITHDRAWALS.REJECT — a separate permission, so the two buttons gate apart. */
  canReject: boolean;
  onView: (withdrawal: Withdrawal) => void;
  onApprove: (withdrawal: Withdrawal) => void;
  onReject: (withdrawal: Withdrawal) => void;
  onTransferSaved: (withdrawal: Withdrawal) => void;
  /**
   * Opens the Verification Details modal for the row — both new columns are
   * click targets. Omitted where no modal is mounted (the user profile's
   * withdrawals card), in which case the badges render as plain text.
   */
  onOpenVerification?: (withdrawal: Withdrawal) => void;
  approvingId?: string | null;
  /**
   * The page's `useNow()` clock for the read-time NO_BANK_TRANSACTION
   * derivation. Optional for callers that don't tick (the user profile
   * card): they get the moment the columns were built.
   */
  now?: number;
}): ColumnDef<Withdrawal>[] {
  const typeLogo = (accountType: string) => types.find((t) => t.value === accountType)?.logoUrl ?? null;
  const clock = now ?? Date.now();

  const VerificationCell = ({ withdrawal, children }: { withdrawal: Withdrawal; children: React.ReactNode }) =>
    onOpenVerification ? (
      <button
        type="button"
        className="flex flex-col items-start gap-1 rounded-md text-left hover:bg-accent/50"
        onClick={() => onOpenVerification(withdrawal)}
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
      header: t.withdrawals.columns.customer,
      // Label, raw login identity and phone all match — see deposits/columns.
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
      header: t.withdrawals.columns.amount,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-outgoing">
          <ArrowUpRight className="size-3.5 shrink-0 text-outgoing" />
          {formatSignedKyat(row.original.amount, "out")}
        </span>
      ),
    },
    {
      accessorKey: "accountName",
      header: t.withdrawals.columns.destinationAccount,
      cell: ({ row }) => {
        const logoUrl = typeLogo(row.original.accountType);
        return (
          <div className="flex items-center gap-2">
            <div
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40"
              title={row.original.accountType}
            >
              {logoUrl ? (
                <Image src={logoUrl} alt={row.original.accountType} width={32} height={32} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm">{row.original.accountName}</span>
              {/* Masked render-only; the full number stays a hover away. */}
              <span className="font-mono text-xs text-muted-foreground">
                {row.original.accountNumber}
              </span>
              {/* The bank the user named on this request — may differ from any bank on their profile. */}
              {row.original.bankName && (
                <span className="text-xs text-muted-foreground">{row.original.bankName}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: t.withdrawals.columns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.withdrawals.columns.status,
      cell: ({ row }) => {
        const withdrawal = row.original;
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={withdrawal.status} tone={STATUS_TONE[withdrawal.status]} />
            {withdrawal.status === "REJECTED" && withdrawal.rejectionReason && (
              <span className="max-w-48 truncate text-xs text-muted-foreground" title={withdrawal.rejectionReason}>
                {withdrawal.rejectionReason}
              </span>
            )}
            {withdrawal.status !== "PENDING" && withdrawal.approvedAt && (
              <span className="text-xs text-muted-foreground">
                {t.withdrawals.columns.processedAt(format(new Date(withdrawal.approvedAt), "d MMM yyyy, HH:mm:ss"))}
              </span>
            )}
          </div>
        );
      },
    },
    {
      // The bank side of the payout: the "You sent …" notification matched
      // onto this row. A PENDING request has nothing to match yet, so the
      // waiting hint only makes sense once staff approved it.
      id: "bankMatch",
      accessorFn: (row) => row.matchStatus,
      header: t.verification.columns.bankMatch,
      cell: ({ row }) => {
        const record = toWithdrawalVerification(row.original);
        const status = viewMatchStatus(record, clock);
        return (
          <VerificationCell withdrawal={row.original}>
            <BankMatchBadge status={status} />
            <span className="text-xs text-muted-foreground">
              {record.bankCheckedAt
                ? format(new Date(record.bankCheckedAt), "d MMM yyyy, HH:mm:ss")
                : status === "UNVERIFIED" && record.status === "APPROVED"
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
        const record = toWithdrawalVerification(row.original);
        return (
          <VerificationCell withdrawal={row.original}>
            <RiskBadge level={viewRiskLevel(record, clock)} reasons={viewRiskReasons(record, clock)} />
          </VerificationCell>
        );
      },
    },
    {
      id: "actions",
      header: t.withdrawals.columns.actions,
      cell: ({ row }) => {
        const withdrawal = row.original;
        const isApproving = approvingId === withdrawal.id;
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => onView(withdrawal)}>
              <Eye className="size-3.5" />
              {t.common.view}
            </Button>
            {withdrawal.status === "PENDING" && (
              <>
                {canApprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={isApproving}
                    onClick={() => onApprove(withdrawal)}
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
                  <Button size="sm" variant="outline" className="gap-1" disabled={isApproving} onClick={() => onReject(withdrawal)}>
                    <X className="size-3.5 text-destructive" />
                    {t.common.reject}
                  </Button>
                )}
              </>
            )}
          </div>
        );
      },
    },
    {
      id: "transferAccount",
      header: t.withdrawals.columns.transferAccount,
      cell: ({ row }) => (
        <TransferAccountCell withdrawal={row.original} accounts={paymentAccounts} types={types} onSaved={onTransferSaved} />
      ),
    },
  ];
}
