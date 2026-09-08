"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatSignedKyat } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Transaction, TransactionStatus, TransactionType } from "@/types/transaction";
import type { Deposit, DepositStatus } from "@/types/deposit";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";

/**
 * The unified payment history for ONE user profile: every deposit, every
 * withdrawal and every remaining wallet-ledger movement in a single
 * chronological table, merged client-side from data the profile page already
 * fetches — no extra requests, no backend changes.
 *
 * DEDUP: approving a deposit/withdrawal also writes a shadow `Transaction`
 * row of type DEPOSIT/WITHDRAWAL (backend deposits.service.ts approve() and
 * createManual(), withdrawals.service.ts approve() — verified 2026-08-31;
 * those are the only writers of these two types). The full Deposit and
 * Withdrawal source rows already carry those events with far more detail, so
 * the merge keeps only the Transaction rows of every OTHER type — but ONLY
 * while the matching source list actually loaded. When a viewer's role gets
 * the deposits/withdrawals fetch refused (null), the shadow rows are all the
 * deposit/withdrawal history that viewer has, so they render as plain ledger
 * rows (amount/date/status, no source detail) rather than vanishing.
 */

/** A transaction kind, in the unified table's own vocabulary. */
type LedgerKind =
  | "purchase"
  | "subscription"
  | "refund"
  | "adjustmentCredit"
  | "adjustmentDebit"
  // The shadow forms: a deposit/withdrawal known only from its ledger row,
  // shown when the full source row was refused. Distinct kind strings so the
  // details/status cells can never mistake them for full source rows.
  | "depositShadow"
  | "withdrawalShadow";

export type PaymentHistoryRow =
  | { kind: "deposit"; id: string; createdAt: string; amount: number; direction: "in"; deposit: Deposit }
  | {
      kind: "withdrawal";
      id: string;
      createdAt: string;
      amount: number;
      direction: "out";
      withdrawal: Withdrawal;
    }
  | {
      kind: LedgerKind;
      id: string;
      createdAt: string;
      amount: number;
      direction: "in" | "out";
      transaction: Transaction;
    };

/**
 * Kind + money direction for every ledger type that survives the dedup.
 * Exhaustive over the non-shadow types, so a new backend TransactionType
 * fails tsc here instead of silently rendering nothing.
 */
const LEDGER_META: Record<TransactionType, { kind: LedgerKind; direction: "in" | "out" }> = {
  PURCHASE: { kind: "purchase", direction: "out" },
  SUBSCRIPTION: { kind: "subscription", direction: "out" },
  REFUND: { kind: "refund", direction: "in" },
  ADJUSTMENT_CREDIT: { kind: "adjustmentCredit", direction: "in" },
  ADJUSTMENT_DEBIT: { kind: "adjustmentDebit", direction: "out" },
  DEPOSIT: { kind: "depositShadow", direction: "in" },
  WITHDRAWAL: { kind: "withdrawalShadow", direction: "out" },
};

/**
 * Merge the three sources into one newest-first list. Pure and exported so
 * the dedup rule is inspectable/testable on its own. `deposits`/`withdrawals`
 * are null when the viewer's role can't see them (the profile page's
 * `.catch(() => null)` contract) — the merge then simply covers less.
 */
export function mergePaymentHistory(
  transactions: Transaction[],
  deposits: Deposit[] | null,
  withdrawals: Withdrawal[] | null
): PaymentHistoryRow[] {
  const rows: PaymentHistoryRow[] = [];

  for (const txn of transactions) {
    // Shadow rows of approved deposits/withdrawals — skipped ONLY when the
    // full source rows are here to represent those events. A refused source
    // fetch (null) means the shadow row is the only record the viewer has.
    if (txn.type === "DEPOSIT" && deposits) continue;
    if (txn.type === "WITHDRAWAL" && withdrawals) continue;
    const meta = LEDGER_META[txn.type];
    rows.push({
      ...meta,
      // Prefixed ids keep the three sources' keys from ever colliding.
      id: `txn-${txn.id}`,
      createdAt: txn.createdAt,
      amount: txn.amount,
      transaction: txn,
    });
  }

  for (const deposit of deposits ?? []) {
    rows.push({
      kind: "deposit",
      direction: "in",
      id: `dep-${deposit.id}`,
      createdAt: deposit.createdAt,
      amount: deposit.amount,
      deposit,
    });
  }

  for (const withdrawal of withdrawals ?? []) {
    rows.push({
      kind: "withdrawal",
      direction: "out",
      id: `wd-${withdrawal.id}`,
      createdAt: withdrawal.createdAt,
      amount: withdrawal.amount,
      withdrawal,
    });
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

const DEPOSIT_TONE: Record<DepositStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const WITHDRAWAL_TONE: Record<WithdrawalStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const TRANSACTION_TONE: Record<TransactionStatus, StatusTone> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
};

/** "KBZPay · K1 · 097••••8999" — one of OUR payment accounts, masked. */
function ourAccountLabel(
  type: string | null,
  subname: string | null,
  number: string | null
): string | null {
  const parts = [type, subname, number].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Everything the Details cell prints, flattened for the search box. Raw
 * (unmasked) numbers on purpose — search always matches the real value,
 * masking is render-only (see lib/mask.ts).
 */
function detailsSearchText(row: PaymentHistoryRow): string {
  switch (row.kind) {
    case "deposit": {
      const d = row.deposit;
      return [
        d.paymentMethod,
        d.reference,
        d.receivingAccountType,
        d.receivingAccountSubname,
        d.receivingAccountName,
        d.receivingAccountNumber,
        d.receivingTransactionCode,
        d.rejectionReason,
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "withdrawal": {
      const w = row.withdrawal;
      return [
        w.accountType,
        w.accountName,
        w.accountNumber,
        w.bankName,
        w.transferAccountType,
        w.transferAccountSubname,
        w.transferAccountName,
        w.transferAccountNumber,
        w.transferTransactionCode,
        w.rejectionReason,
      ]
        .filter(Boolean)
        .join(" ");
    }
    default:
      return row.transaction.movieTitle ?? "";
  }
}

/** A muted secondary line, truncated with the full text a hover away. */
function DetailLine({ children, title, mono }: { children: React.ReactNode; title?: string; mono?: boolean }) {
  return (
    <span
      className={cn("max-w-64 truncate text-xs text-muted-foreground", mono && "font-mono")}
      title={title}
    >
      {children}
    </span>
  );
}

function DetailsCell({ row, t }: { row: PaymentHistoryRow; t: TranslationShape }) {
  const i = t.users.paymentHistory;
  switch (row.kind) {
    case "deposit": {
      const d = row.deposit;
      const receiving = ourAccountLabel(
        d.receivingAccountType,
        d.receivingAccountSubname,
        d.receivingAccountNumber
      );
      return (
        <div className="flex flex-col gap-0.5">
          <span className="max-w-64 truncate text-sm" title={d.paymentMethod}>
            {d.paymentMethod}
          </span>
          {receiving && (
            <DetailLine>
              {i.receivedInto(receiving)}
            </DetailLine>
          )}
          <DetailLine mono title={d.reference}>
            {i.referenceLine(d.reference)}
          </DetailLine>
          {d.rejectionReason && <DetailLine title={d.rejectionReason}>{d.rejectionReason}</DetailLine>}
          {d.status !== "PENDING" && d.approvedAt && (
            <DetailLine>
              {t.deposits.columns.processedAt(format(new Date(d.approvedAt), "d MMM yyyy, HH:mm:ss"))}
            </DetailLine>
          )}
        </div>
      );
    }
    case "withdrawal": {
      const w = row.withdrawal;
      const transfer = ourAccountLabel(
        w.transferAccountType,
        w.transferAccountSubname,
        w.transferAccountNumber
      );
      return (
        <div className="flex flex-col gap-0.5">
          <span className="max-w-64 truncate text-sm" title={w.accountName}>
            {w.accountName}
          </span>
          {/* Masked render-only; the full number stays a hover away. */}
          <DetailLine mono title={w.accountNumber}>
            {w.accountType} · {w.accountNumber}
            {w.bankName ? ` · ${w.bankName}` : ""}
          </DetailLine>
          {transfer && (
            <DetailLine>{i.sentFrom(transfer)}</DetailLine>
          )}
          {w.transferTransactionCode && (
            <DetailLine mono>{i.codeLine(w.transferTransactionCode)}</DetailLine>
          )}
          {w.rejectionReason && <DetailLine title={w.rejectionReason}>{w.rejectionReason}</DetailLine>}
        </div>
      );
    }
    case "purchase":
    case "refund":
      return row.transaction.movieTitle ? (
        <span className="max-w-64 truncate text-sm" title={row.transaction.movieTitle}>
          {row.transaction.movieTitle}
        </span>
      ) : (
        <span className="text-sm italic text-muted-foreground">—</span>
      );
    case "subscription":
      return <span className="text-sm text-muted-foreground">{i.subscriptionDetail}</span>;
    case "adjustmentCredit":
      return <span className="text-sm text-muted-foreground">{i.adjustmentCreditDetail}</span>;
    case "adjustmentDebit":
      return <span className="text-sm text-muted-foreground">{i.adjustmentDebitDetail}</span>;
    case "depositShadow":
    case "withdrawalShadow":
      // Known only from the ledger — the caption above the table already
      // explains why the source detail is missing.
      return <span className="text-sm italic text-muted-foreground">—</span>;
  }
}

function StatusCell({ row }: { row: PaymentHistoryRow }) {
  switch (row.kind) {
    case "deposit":
      // Each source keeps its own status vocabulary — the enum strings the
      // deposits/withdrawals/finance tables already print, untranslated.
      return <StatusBadge label={row.deposit.status} tone={DEPOSIT_TONE[row.deposit.status]} />;
    case "withdrawal":
      return (
        <StatusBadge label={row.withdrawal.status} tone={WITHDRAWAL_TONE[row.withdrawal.status]} />
      );
    default:
      return (
        <StatusBadge
          label={row.transaction.status}
          tone={TRANSACTION_TONE[row.transaction.status]}
        />
      );
  }
}

function getColumns(t: TranslationShape): ColumnDef<PaymentHistoryRow>[] {
  const i = t.users.paymentHistory;
  return [
    {
      accessorKey: "createdAt",
      header: i.columns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      id: "kind",
      header: i.columns.kind,
      cell: ({ row }) => {
        const inbound = row.original.direction === "in";
        return (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            {inbound ? (
              <ArrowDownLeft className="size-3.5 shrink-0 text-income" />
            ) : (
              <ArrowUpRight className="size-3.5 shrink-0 text-outgoing" />
            )}
            {i.kinds[
              row.original.kind === "depositShadow"
                ? "deposit"
                : row.original.kind === "withdrawalShadow"
                  ? "withdrawal"
                  : row.original.kind
            ]}
          </span>
        );
      },
    },
    {
      id: "amount",
      // Signed accessor so sorting interleaves money-in and money-out
      // correctly instead of by magnitude.
      accessorFn: (row) => (row.direction === "in" ? row.amount : -row.amount),
      header: i.columns.amount,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={cn(
            "text-[15px] font-semibold tabular-nums",
            row.original.direction === "in" ? "text-income" : "text-outgoing"
          )}
        >
          {formatSignedKyat(row.original.amount, row.original.direction)}
        </span>
      ),
    },
    {
      id: "details",
      // The accessor is what the search box matches — every reference,
      // account number, code and title the cell can print, raw.
      accessorFn: detailsSearchText,
      header: i.columns.details,
      enableSorting: false,
      cell: ({ row }) => <DetailsCell row={row.original} t={t} />,
    },
    {
      id: "status",
      header: i.columns.status,
      cell: ({ row }) => <StatusCell row={row.original} />,
    },
  ];
}

export function UserPaymentHistory({
  transactions,
  transactionsTotal,
  deposits,
  withdrawals,
}: {
  transactions: Transaction[];
  /** Server-side total, so a capped fetch window can say so instead of presenting a truncated chronology as complete. */
  transactionsTotal?: number;
  /** Null when the viewer's role can't read deposits (refused fetch). */
  deposits: Deposit[] | null;
  /** Null when the viewer's role can't read withdrawals (refused fetch). */
  withdrawals: Withdrawal[] | null;
}) {
  const { t } = useLanguage();
  const rows = useMemo(
    () => mergePaymentHistory(transactions, deposits, withdrawals),
    [transactions, deposits, withdrawals]
  );
  const columns = useMemo(() => getColumns(t), [t]);
  // Transactions loaded but the source documents were refused — the table
  // still renders what it has, it just says the coverage is partial.
  const detailUnavailable = !deposits || !withdrawals;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t.users.profile.paymentHistoryTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {transactionsTotal !== undefined && transactionsTotal > transactions.length && (
          <p className="mb-3 text-xs text-muted-foreground">
            {t.users.financeSummary.partialNote(transactions.length, transactionsTotal)}
          </p>
        )}
        {detailUnavailable && (
          <p className="mb-3 text-xs text-muted-foreground">
            {t.users.paymentHistory.detailUnavailable}
          </p>
        )}
        <DataTable
          columns={columns}
          data={rows}
          searchKey="details"
          searchPlaceholder={t.users.paymentHistory.searchPlaceholder}
          emptyState={
            <EmptyState
              icon={Receipt}
              title={t.users.paymentHistory.emptyTitle}
              description={t.users.paymentHistory.emptyDescription}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
