"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Landmark, User, UserRound, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel, userLabelOr } from "@/lib/user-label";
import { useLanguage } from "@/lib/context/language-context";
import { CREDIT_TRANSACTION_TYPES } from "@/types/payment-account-transaction";
import type {
  PaymentAccountTransaction,
  PaymentAccountTransactionAccountRef,
  PaymentAccountTransactionCustomer,
} from "@/types/payment-account-transaction";
import type { DepositStatus } from "@/types/deposit";
import type { WithdrawalStatus } from "@/types/withdrawal";

const DEPOSIT_STATUS_TONE: Record<DepositStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const WITHDRAWAL_STATUS_TONE: Record<WithdrawalStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const EM_DASH = "—";

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d MMM yyyy, HH:mm:ss");
}

function accountLabel(account: PaymentAccountTransactionAccountRef) {
  return account.subname
    ? `${account.type} — ${account.subname} (${account.accountName})`
    : `${account.type} (${account.accountName})`;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Wallet;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {/* Two columns of stacked label/value pairs rather than one tall list of
          label-left/value-right rows: roughly half the height, and the eye
          tracks straight down one edge instead of zig-zagging. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

/**
 * A field with nothing in it is dropped rather than rendered as a dash, so the
 * panel's length tracks how much is actually known about the transaction —
 * a manual entry stays short instead of padding itself out with empty rows.
 */
function Field({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** Spans both columns — for ids, notes and other values too long to sit in half a row. */
  full?: boolean;
}) {
  if (value === null || value === undefined || value === "" || value === EM_DASH) return null;
  return (
    <div className={`min-w-0 ${full ? "col-span-2 sm:col-span-3" : ""}`}>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 text-sm leading-snug font-medium ${mono ? "font-mono text-xs break-all" : "break-words"}`}>
        {value}
      </dd>
    </div>
  );
}

const USER_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

/**
 * Who the money actually came from or went to. Given its own section ahead of
 * the deposit/withdrawal detail because "who is this?" is the first thing an
 * admin reviewing a movement asks.
 *
 * The heading is the name the customer set for themselves (`userLabel`), with
 * the raw `@username` muted underneath — a display name must never hide which
 * account this is. The phone keeps its own field in the grid below.
 */
function CustomerSection({
  customer,
  t,
}: {
  customer: PaymentAccountTransactionCustomer;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const d = t.paymentAccountLedger.details;
  return (
    <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <UserRound className="size-3.5" />
        {d.customerSection}
      </h3>

      <div className="mb-2.5 flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarImage src={customer.avatarUrl ?? undefined} alt={userLabel(customer)} />
          <AvatarFallback>{userLabel(customer).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{userLabel(customer)}</p>
          <p className="truncate text-xs text-muted-foreground">@{customer.username}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1"
          render={<Link href={`/users/${customer.id}`} />}
          nativeButton={false}
        >
          <ExternalLink className="size-3.5" />
          {d.viewProfile}
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Field label={d.customerPhone} value={formatLocalPhone(customer.phone)} mono />
        <Field
          label={d.customerStatus}
          value={
            <StatusBadge
              label={customer.status}
              tone={USER_STATUS_TONE[customer.status] ?? "neutral"}
            />
          }
        />
        <Field label={d.customerRole} value={customer.role} />
        <Field
          label={d.walletBalance}
          value={customer.walletBalance === null ? d.noWallet : formatKyat(customer.walletBalance)}
        />
        <Field label={d.memberSince} value={formatDateTime(customer.createdAt)} />
        <Field label={d.lastLogin} value={formatDateTime(customer.lastLoginAt) ?? d.neverLoggedIn} />
        <Field label={d.customerId} value={customer.id} mono full />
      </dl>
    </section>
  );
}

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: PaymentAccountTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const d = t.paymentAccountLedger.details;

  if (!transaction) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const isCredit = CREDIT_TRANSACTION_TYPES.includes(transaction.type);
  const { paymentAccount: account, relatedDeposit: deposit, relatedWithdrawal: withdrawal } = transaction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>
            {d.subtitle(t.paymentAccountLedger.types[transaction.type], formatKyat(transaction.amount))}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          <Section title={d.entrySection} icon={Wallet}>
            <Field
              label={d.type}
              value={
                <StatusBadge
                  label={t.paymentAccountLedger.types[transaction.type]}
                  tone={isCredit ? "success" : "warning"}
                />
              }
            />
            <Field
              label={d.amount}
              value={
                <span className={isCredit ? "text-success tabular-nums" : "text-destructive tabular-nums"}>
                  {isCredit ? "+" : "-"}
                  {formatKyat(transaction.amount)}
                </span>
              }
            />
            <Field label={d.direction} value={isCredit ? d.credit : d.debit} />
            <Field label={d.balanceBefore} value={formatKyat(transaction.balanceBefore)} />
            <Field label={d.balanceAfter} value={formatKyat(transaction.balanceAfter)} />
            <Field label={d.referenceCode} value={transaction.referenceCode} mono />
            <Field label={d.recordedAt} value={formatDateTime(transaction.createdAt)} />
            <Field label={d.note} value={transaction.note} full />
            <Field label={d.entryId} value={transaction.id} mono full />
          </Section>

          {deposit && (
            <Section title={d.depositSection} icon={ArrowDownToLine}>
              <Field label={d.depositAmount} value={formatKyat(deposit.amount)} />
              <Field label={d.depositPaymentMethod} value={deposit.paymentMethod} />
              <Field label={d.depositSentFromAccount} value={deposit.accountName} />
              <Field label={d.depositReference} value={deposit.reference} mono />
              <Field
                label={d.depositStatus}
                value={
                  <StatusBadge label={deposit.status} tone={DEPOSIT_STATUS_TONE[deposit.status]} />
                }
              />
              <Field label={d.rejectionReason} value={deposit.rejectionReason} full />
              <Field label={d.approvedBy} value={deposit.approvedBy && userLabel(deposit.approvedBy)} />
              <Field label={d.approvedAt} value={formatDateTime(deposit.approvedAt)} />
              <Field
                label={d.depositWalletBalance}
                value={
                  deposit.walletBalanceBefore !== null && deposit.walletBalanceAfter !== null
                    ? `${formatKyat(deposit.walletBalanceBefore)} → ${formatKyat(deposit.walletBalanceAfter)}`
                    : EM_DASH
                }
                full
              />
              <Field
                label={d.creditedAccount}
                value={deposit.receivingPaymentAccount ? accountLabel(deposit.receivingPaymentAccount) : null}
                full
              />
              <Field label={d.receivingAccountType} value={deposit.receivingAccountType} />
              <Field label={d.receivingAccountSubname} value={deposit.receivingAccountSubname} />
              <Field label={d.receivingAccountName} value={deposit.receivingAccountName} />
              <Field label={d.receivingAccountNumber} value={deposit.receivingAccountNumber} mono />
              <Field label={d.receivingTransactionCode} value={deposit.receivingTransactionCode} mono />
              <Field label={d.receivingTransactionTime} value={deposit.receivingTransactionTime} mono />
              <Field label={d.depositCreatedAt} value={formatDateTime(deposit.createdAt)} />
              <Field label={d.depositUpdatedAt} value={formatDateTime(deposit.updatedAt)} />
              <Field label={d.depositId} value={deposit.id} mono full />
            </Section>
          )}

          {withdrawal && (
            <Section title={d.withdrawalSection} icon={ArrowUpFromLine}>
              <Field label={d.withdrawalAmount} value={formatKyat(withdrawal.amount)} />
              <Field label={d.payeeAccountType} value={withdrawal.accountType} />
              <Field label={d.payeeBankName} value={withdrawal.bankName} />
              <Field label={d.payeeAccountName} value={withdrawal.accountName} />
              <Field label={d.payeeAccountNumber} value={withdrawal.accountNumber} mono />
              <Field
                label={d.withdrawalStatus}
                value={
                  <StatusBadge
                    label={withdrawal.status}
                    tone={WITHDRAWAL_STATUS_TONE[withdrawal.status]}
                  />
                }
              />
              <Field label={d.rejectionReason} value={withdrawal.rejectionReason} full />
              <Field label={d.approvedBy} value={withdrawal.approvedBy && userLabel(withdrawal.approvedBy)} />
              <Field label={d.approvedAt} value={formatDateTime(withdrawal.approvedAt)} />
              <Field
                label={d.debitedAccount}
                value={
                  withdrawal.transferPaymentAccount
                    ? accountLabel(withdrawal.transferPaymentAccount)
                    : null
                }
                full
              />
              <Field label={d.transferAccountType} value={withdrawal.transferAccountType} />
              <Field label={d.transferAccountSubname} value={withdrawal.transferAccountSubname} />
              <Field label={d.transferAccountName} value={withdrawal.transferAccountName} />
              <Field label={d.transferAccountNumber} value={withdrawal.transferAccountNumber} mono />
              <Field label={d.transferTransactionCode} value={withdrawal.transferTransactionCode} mono />
              <Field label={d.transferTransactionTime} value={withdrawal.transferTransactionTime} mono />
              <Field label={d.withdrawalCreatedAt} value={formatDateTime(withdrawal.createdAt)} />
              <Field label={d.withdrawalUpdatedAt} value={formatDateTime(withdrawal.updatedAt)} />
              <Field label={d.withdrawalId} value={withdrawal.id} mono full />
            </Section>
          )}

          {/* A linked record that has since been deleted leaves the id behind but
              nulls the relation — saying so beats silently showing nothing. */}
          {!deposit && transaction.relatedDepositId && (
            <Section title={d.depositSection} icon={ArrowDownToLine}>
              <Field label={d.depositId} value={transaction.relatedDepositId} mono full />
              <Field label={d.linkedRecord} value={d.recordUnavailable} />
            </Section>
          )}
          {!withdrawal && transaction.relatedWithdrawalId && (
            <Section title={d.withdrawalSection} icon={ArrowUpFromLine}>
              <Field label={d.withdrawalId} value={transaction.relatedWithdrawalId} mono full />
              <Field label={d.linkedRecord} value={d.recordUnavailable} />
            </Section>
          )}

          {/* One customer block regardless of which side produced the entry —
              a row is never linked to both a deposit and a withdrawal. */}
          {(deposit ?? withdrawal) && (
            <CustomerSection customer={(deposit ?? withdrawal)!.user} t={t} />
          )}

          <Section title={d.accountSection} icon={Landmark}>
            <Field label={d.accountName} value={account.accountName} />
            <Field label={d.accountSubname} value={account.subname} />
            <Field label={d.paymentMethod} value={account.type} />
            <Field label={d.accountNumber} value={account.accountNumber} mono />
            <Field label={d.bankName} value={account.bankName} />
            <Field
              label={d.accountStatus}
              value={
                <StatusBadge
                  label={account.isActive ? d.active : d.inactive}
                  tone={account.isActive ? "success" : "neutral"}
                />
              }
            />
            <Field label={d.accountNote} value={account.note} full />
            <Field label={d.accountId} value={account.id} mono full />
          </Section>

          <Section title={d.performedBySection} icon={User}>
            <Field
              label={d.performedBy}
              value={userLabelOr(transaction.performedBy, d.system)}
            />
            <Field label={d.performerRole} value={transaction.performedBy?.role} />
            <Field label={d.performerId} value={transaction.performedBy?.id} mono full />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
