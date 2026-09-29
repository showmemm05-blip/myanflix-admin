"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Camera, Landmark, Link2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BankScreenshot } from "@/components/shared/BankScreenshot";
import { BankTransactionBadge } from "@/components/bank-transactions/BankTransactionBadge";
import { useLanguage } from "@/lib/context/language-context";
import { formatSignedKyat } from "@/lib/currency";
import { shortId, viewOf } from "@/lib/bank-transactions";
import { bankTransactionService } from "@/services/api/bankTransactionService";
import type { BankTransaction } from "@/types/bank-transaction";

const EM_DASH = "—";

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d MMM yyyy, HH:mm:ss");
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Landmark; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One label/value pair; an empty value renders as a dash so the layout never collapses. */
function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-snug font-medium ${mono ? "font-mono text-xs break-all" : "break-words"} ${
          empty ? "text-muted-foreground" : ""
        }`}
      >
        {empty ? EM_DASH : value}
      </dd>
    </div>
  );
}

/**
 * Everything the phone captured for one bank transaction, plus where it went.
 * Reads the row from the page's state (not a snapshot) so a
 * `bank-transaction.updated` push — a late match, a screenshot arriving —
 * updates the open dialog live. Also the landing view for
 * `/bank-transactions?id=…` links from Verification Details.
 */
export function BankTransactionDetailDialog({
  row,
  open,
  onOpenChange,
  now,
  accountLabel,
  canViewScreenshot,
  canOpenLinked,
  linkedLoading,
  onOpenLinked,
}: {
  row: BankTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The page's `useNow()` clock — the 48 h unclaimed derivation is computed against it. */
  now: number;
  accountLabel: string | null;
  /** BANK_TRANSACTIONS.BANK_EVIDENCE. */
  canViewScreenshot: boolean;
  /** DEPOSITS.VIEW / WITHDRAWALS.VIEW for whichever side this row is linked to. */
  canOpenLinked: boolean;
  linkedLoading: boolean;
  onOpenLinked: (row: BankTransaction) => void;
}) {
  const { t } = useLanguage();
  const b = t.bankTransactions;

  if (!row) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const view = viewOf(row, now);
  const received = row.direction === "RECEIVED";
  const linkedId = row.linkedDepositId ?? row.linkedWithdrawalId;
  // MATCHED with no link left = the deposit/withdrawal was hard-deleted (FK
  // SET NULL); say so instead of showing a dash under "Matched".
  const linkLost = row.state === "MATCHED" && linkedId === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{b.detail.title}</DialogTitle>
          <DialogDescription>{b.detail.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={`inline-flex items-center gap-1.5 text-base font-semibold tabular-nums ${
              received ? "text-income" : "text-outgoing"
            }`}
          >
            {received ? <ArrowDownLeft className="size-4 shrink-0" /> : <ArrowUpRight className="size-4 shrink-0" />}
            {formatSignedKyat(row.amount, received ? "in" : "out")}
          </span>
          <StatusBadge
            label={received ? b.filters.received : b.filters.sent}
            tone={received ? "success" : "info"}
            className="normal-case"
          />
          <BankTransactionBadge view={view} />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Section title={b.columns.phone} icon={Smartphone}>
              <dl className="grid grid-cols-1 gap-y-2">
                <Field label={b.detail.deviceSerial} value={row.deviceSerial} mono />
                <Field label={b.columns.account} value={accountLabel} />
                <Field label={b.detail.postedAt} value={formatDateTime(row.postedAt)} />
                <Field label={b.detail.detailStatus} value={row.detailStatus} mono />
              </dl>
            </Section>

            <Section title={b.columns.bankTime} icon={Landmark}>
              <dl className="grid grid-cols-1 gap-y-2">
                <Field
                  label={b.columns.code}
                  value={
                    <span className="font-mono text-xs">
                      <span className="text-muted-foreground">{row.txCode.slice(0, -row.txCodeLast6.length)}</span>
                      <span className="font-bold text-foreground">{row.txCodeLast6}</span>
                    </span>
                  }
                />
                <Field label={b.detail.occurredAt} value={formatDateTime(row.occurredAt)} />
                <Field label={b.columns.sender} value={row.counterparty} />
                <Field label={b.detail.transactionId} value={row.id} mono />
              </dl>
            </Section>
          </div>

          <Section title={b.columns.link} icon={Link2}>
            {linkedId ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dl className="grid grid-cols-1 gap-y-2">
                  <Field
                    label={row.linkedDepositId ? t.audit.targetTypes.deposit : t.audit.targetTypes.withdrawal}
                    value={linkedId}
                    mono
                  />
                  <Field label={b.detail.matchedAt} value={formatDateTime(row.matchedAt)} />
                </dl>
                {canOpenLinked && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={linkedLoading}
                    onClick={() => onOpenLinked(row)}
                  >
                    {linkedLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                    {row.linkedDepositId ? b.actions.openDeposit : b.actions.openWithdrawal}
                    <span className="font-mono text-[10px] text-muted-foreground">{shortId(linkedId)}</span>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{linkLost ? b.detail.linkLost : b.detail.noLink}</p>
            )}
          </Section>

          <Section title={b.columns.screenshot} icon={Camera}>
            {row.hasScreenshot ? (
              canViewScreenshot ? (
                <BankScreenshot rowId={row.id} load={() => bankTransactionService.fetchScreenshot(row.id)} />
              ) : (
                <p className="text-xs text-muted-foreground">{b.screenshotRestricted}</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">{b.noScreenshot}</p>
            )}
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
