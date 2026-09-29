"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, Camera, Eye, Link2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BankTransactionBadge } from "@/components/bank-transactions/BankTransactionBadge";
import { formatSignedKyat } from "@/lib/currency";
import { bankTransactionAccountLabel, shortId, viewOf } from "@/lib/bank-transactions";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { BankTransaction } from "@/types/bank-transaction";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

const DATE_FORMAT = "d MMM yyyy, HH:mm:ss";

export function getBankTransactionColumns({
  t,
  paymentAccounts,
  types,
  canViewScreenshot,
  canOpenDeposit,
  canOpenWithdrawal,
  onViewScreenshot,
  onOpenLinked,
  onViewDetails,
  linkedLoadingId,
  now,
}: {
  t: TranslationShape;
  paymentAccounts: PaymentAccount[];
  types: PaymentAccountType[];
  /** BANK_TRANSACTIONS.BANK_EVIDENCE — without it the screenshot cell shows a lock, never the image. */
  canViewScreenshot: boolean;
  /** DEPOSITS.VIEW / WITHDRAWALS.VIEW — the link button needs the destination's own read permission. */
  canOpenDeposit: boolean;
  canOpenWithdrawal: boolean;
  onViewScreenshot: (row: BankTransaction) => void;
  onOpenLinked: (row: BankTransaction) => void;
  onViewDetails: (row: BankTransaction) => void;
  linkedLoadingId: string | null;
  /** The page's `useNow()` clock for the read-time UNCLAIMED derivation. */
  now: number;
}): ColumnDef<BankTransaction>[] {
  return [
    {
      accessorKey: "deviceSerial",
      header: t.bankTransactions.columns.phone,
      cell: ({ row }) => (
        // There is no server-side device name: a phone's only identity is its
        // serial, and a phone IS one business account (the phone-monitor maps
        // serial → account), so the account label under the serial is the
        // friendliest name we can give it without inventing one.
        <div className="flex max-w-44 flex-col">
          <span className="truncate font-mono text-xs font-medium" title={row.original.deviceSerial}>
            {row.original.deviceSerial}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {bankTransactionAccountLabel(row.original, paymentAccounts, types)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "direction",
      header: t.bankTransactions.columns.direction,
      cell: ({ row }) => {
        const received = row.original.direction === "RECEIVED";
        return (
          <StatusBadge
            label={received ? t.bankTransactions.filters.received : t.bankTransactions.filters.sent}
            tone={received ? "success" : "info"}
            className="normal-case"
          />
        );
      },
    },
    {
      accessorKey: "amount",
      header: t.bankTransactions.columns.amount,
      meta: { align: "right" },
      cell: ({ row }) => {
        const received = row.original.direction === "RECEIVED";
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-[15px] font-semibold tabular-nums ${
              received ? "text-income" : "text-outgoing"
            }`}
          >
            {received ? <ArrowDownLeft className="size-3.5 shrink-0" /> : <ArrowUpRight className="size-3.5 shrink-0" />}
            {formatSignedKyat(row.original.amount, received ? "in" : "out")}
          </span>
        );
      },
    },
    {
      accessorKey: "txCode",
      header: t.bankTransactions.columns.code,
      // The search box matches the full code, the last 6 a depositor would
      // type, the sender and the phone — whichever the admin has in hand.
      filterFn: (row, _columnId, value) => {
        const needle = String(value).trim().toLowerCase();
        if (!needle) return true;
        const r = row.original;
        return [r.txCode, r.txCodeLast6, r.counterparty ?? "", r.deviceSerial].some((field) =>
          field.toLowerCase().includes(needle),
        );
      },
      cell: ({ row }) => {
        const { txCode, txCodeLast6 } = row.original;
        const head = txCode.endsWith(txCodeLast6) ? txCode.slice(0, -txCodeLast6.length) : txCode;
        return (
          <span className="font-mono text-xs" title={txCode}>
            <span className="text-muted-foreground">{head}</span>
            <span className="font-bold text-foreground">{txCodeLast6}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "occurredAt",
      header: t.bankTransactions.columns.bankTime,
      cell: ({ row }) => (
        <span
          className="text-sm tabular-nums text-muted-foreground"
          // The notification time on hover — the two differ when the phone
          // was offline or the bank posted late.
          title={`${t.bankTransactions.columns.postedAt}: ${format(new Date(row.original.postedAt), DATE_FORMAT)}`}
        >
          {format(new Date(row.original.occurredAt), DATE_FORMAT)}
        </span>
      ),
    },
    {
      accessorKey: "counterparty",
      header: t.bankTransactions.columns.sender,
      cell: ({ row }) =>
        row.original.counterparty ? (
          <span className="max-w-40 truncate text-sm" title={row.original.counterparty}>
            {row.original.counterparty}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "state",
      accessorFn: (row) => row.state,
      header: t.bankTransactions.columns.state,
      cell: ({ row }) => {
        const view = viewOf(row.original, now);
        return (
          <div className="flex flex-col items-start gap-1">
            <BankTransactionBadge view={view} />
            {row.original.matchedAt && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(row.original.matchedAt), DATE_FORMAT)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "screenshot",
      header: t.bankTransactions.columns.screenshot,
      cell: ({ row }) => {
        if (!row.original.hasScreenshot) return <span className="text-xs text-muted-foreground">—</span>;
        if (!canViewScreenshot) {
          return (
            <span
              className="inline-flex items-center text-muted-foreground"
              title={t.bankTransactions.screenshotRestricted}
              aria-label={t.bankTransactions.screenshotRestricted}
            >
              <Lock className="size-3.5" />
            </span>
          );
        }
        return (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => onViewScreenshot(row.original)}
            aria-label={t.bankTransactions.actions.viewScreenshot}
            title={t.bankTransactions.actions.viewScreenshot}
          >
            <Camera className="size-3.5" />
          </Button>
        );
      },
    },
    {
      id: "link",
      header: t.bankTransactions.columns.link,
      cell: ({ row }) => {
        const tx = row.original;
        const linkedId = tx.linkedDepositId ?? tx.linkedWithdrawalId;
        if (!linkedId) return <span className="text-xs text-muted-foreground">—</span>;
        const allowed = tx.linkedDepositId ? canOpenDeposit : canOpenWithdrawal;
        if (!allowed) {
          // Without the destination's VIEW permission the id is still shown —
          // it is a fact about this row — but there is nothing to open.
          return <span className="font-mono text-xs text-muted-foreground">{shortId(linkedId)}</span>;
        }
        const loading = linkedLoadingId === tx.id;
        return (
          <Button size="sm" variant="outline" className="gap-1" disabled={loading} onClick={() => onOpenLinked(tx)}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
            {tx.linkedDepositId ? t.audit.targetTypes.deposit : t.audit.targetTypes.withdrawal}
            <span className="font-mono text-[10px] text-muted-foreground">{shortId(linkedId)}</span>
          </Button>
        );
      },
    },
    {
      id: "actions",
      header: t.bankTransactions.columns.actions,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={() => onViewDetails(row.original)}
          aria-label={t.bankTransactions.actions.viewDetails}
          title={t.bankTransactions.actions.viewDetails}
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];
}
