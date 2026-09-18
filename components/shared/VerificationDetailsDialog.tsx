"use client";

import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Camera, Check, Landmark, Lightbulb, ListChecks, Loader2, ShieldAlert, Unlink, UserRound, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BankMatchBadge } from "@/components/shared/BankMatchBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import {
  formatDurationMs,
  timeGapMs,
  viewMatchStatus,
  viewRiskLevel,
  viewRiskReasons,
  type VerificationRecord,
} from "@/lib/bank-verification";
import type { BankMatchStatusView, VerificationReviewAction } from "@/types/bank-verification";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { BankScreenshot } from "@/components/shared/BankScreenshot";

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

/**
 * One label/value pair. Unlike the ledger dialog's Field, an EMPTY value is
 * rendered as a dash here on purpose: the whole point of the two columns is
 * to show what the bank did NOT say next to what the user did.
 */
function Field({
  label,
  value,
  mono,
  mismatch,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** Paints the value red — the bank disagrees with the submitted side. */
  mismatch?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-snug font-medium ${mono ? "font-mono text-xs break-all" : "break-words"} ${
          mismatch ? "text-destructive" : ""
        } ${empty ? "text-muted-foreground" : ""}`}
      >
        {empty ? EM_DASH : value}
      </dd>
    </div>
  );
}

function accountLabel(id: string | null, accounts: PaymentAccount[], types: PaymentAccountType[]) {
  if (!id) return null;
  const account = accounts.find((a) => a.id === id);
  if (!account) return id;
  const typeLabel = types.find((ty) => ty.value === account.type)?.label ?? account.type;
  return `${typeLabel}${account.subname ? ` — ${account.subname}` : ""} (${account.accountName})`;
}

/**
 * Submitted vs bank, side by side, for one deposit or withdrawal. Reads from
 * the page's row state (not a snapshot) so a `*.verification` socket push
 * updates the open modal live. The review actions are gated on EDIT, the
 * screenshot on BANK_EVIDENCE; Approve/Reject appear while the money state
 * is still PENDING and go through the page's handlers (which ask for a
 * confirmation on a SUSPICIOUS row).
 */
export function VerificationDetailsDialog({
  record,
  now,
  open,
  onOpenChange,
  paymentAccounts,
  types,
  canReview,
  canViewScreenshot,
  canApprove,
  canReject,
  approving,
  onReview,
  onApprove,
  onReject,
  fetchScreenshot,
}: {
  record: VerificationRecord | null;
  /** The page's `useNow()` clock — the 24 h no-bank derivation is computed against it. */
  now: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentAccounts: PaymentAccount[];
  types: PaymentAccountType[];
  /** DEPOSITS.EDIT / WITHDRAWALS.EDIT. */
  canReview: boolean;
  /** DEPOSITS.BANK_EVIDENCE / WITHDRAWALS.BANK_EVIDENCE. */
  canViewScreenshot: boolean;
  canApprove: boolean;
  canReject: boolean;
  approving: boolean;
  /** Resolves once the row in page state has been replaced; rejects on API error (the page toasts). */
  onReview: (action: VerificationReviewAction, note: string) => Promise<void>;
  onApprove: () => void;
  onReject: () => void;
  fetchScreenshot: (id: string) => Promise<Blob>;
}) {
  const { t } = useLanguage();
  const m = t.verification.modal;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<VerificationReviewAction | null>(null);
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  const runReview = async (action: VerificationReviewAction) => {
    setBusy(action);
    try {
      await onReview(action, note);
      setNote("");
    } catch {
      // The page already toasted the API error; keep the note so the admin
      // can retry without retyping it.
    } finally {
      setBusy(null);
    }
  };

  if (!record) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const isDeposit = record.kind === "deposit";
  const status = viewMatchStatus(record, now);
  const reasons = viewRiskReasons(record, now);
  const riskLevel = viewRiskLevel(record, now);
  const bankSeen = record.bankCheckedAt !== null;
  const amountMismatch = bankSeen && record.bankAmount !== null && record.bankAmount !== record.amount;
  const codeMismatch =
    bankSeen &&
    record.reference !== null &&
    record.bankCode !== null &&
    record.reference.toUpperCase() !== record.bankCode.toUpperCase();
  const gap = timeGapMs(record);
  const account = accountLabel(record.paymentAccountId, paymentAccounts, types);

  const suggested = suggestedText(status, isDeposit, t.verification.suggested);
  const gapText =
    gap === null
      ? null
      : isDeposit
        ? gap >= 0
          ? m.submittedAfterBank(formatDurationMs(gap))
          : m.submittedBeforeBank(formatDurationMs(gap))
        : gap <= 0
          ? m.approvedBeforePayout(formatDurationMs(gap))
          : m.approvedAfterPayout(formatDurationMs(gap));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.title}</DialogTitle>
          <DialogDescription>{m.description}</DialogDescription>
        </DialogHeader>

        {/* Who + how much + the two verdict pills, in one line. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex flex-col">
            <span className="font-semibold">{record.userName}</span>
            {record.userUsername && (
              <span className="text-xs text-muted-foreground">@{record.userUsername}</span>
            )}
          </span>
          <span className="text-base font-semibold tabular-nums">{formatKyat(record.amount)}</span>
          <BankMatchBadge status={status} />
          <RiskBadge level={riskLevel} reasons={reasons} />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Section title={isDeposit ? m.submittedSection : m.approvedSection} icon={UserRound}>
              <dl className="grid grid-cols-1 gap-y-2">
                <Field label={m.amount} value={formatKyat(record.amount)} mismatch={amountMismatch} />
                {isDeposit && <Field label={m.reference} value={record.reference} mono mismatch={codeMismatch} />}
                <Field label={m.account} value={account ?? m.accountNotDeclared} />
                <Field
                  label={isDeposit ? m.submittedAt : m.approvedAt}
                  value={formatDateTime(isDeposit ? record.submittedAt : record.approvedAt)}
                />
                {record.declaredTransferAt && (
                  <Field label={m.declaredTransferAt} value={formatDateTime(record.declaredTransferAt)} />
                )}
              </dl>
            </Section>

            <Section title={m.bankSection} icon={Landmark}>
              <dl className="grid grid-cols-1 gap-y-2">
                <Field
                  label={m.amount}
                  value={record.bankAmount !== null ? formatKyat(record.bankAmount) : null}
                  mismatch={amountMismatch}
                />
                <Field
                  label={isDeposit ? m.bankCode : m.payoutCode}
                  value={record.bankCode}
                  mono
                  mismatch={codeMismatch}
                />
                {/* The matcher only ever matches on the declared account, so
                    the bank side is that same account by construction. */}
                <Field label={m.account} value={bankSeen ? (account ?? m.accountNotDeclared) : null} />
                <Field label={m.bankTime} value={formatDateTime(record.bankAt)} />
                <Field
                  label={m.checkedAt}
                  value={
                    record.bankCheckedAt
                      ? formatDateTime(record.bankCheckedAt)
                      : status === "UNVERIFIED"
                        ? m.waitingForBank
                        : m.notChecked
                  }
                />
              </dl>
            </Section>
          </div>

          {gapText && (
            <p className="px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.timeGap}:</span> {gapText}
            </p>
          )}

          <Section title={m.reasonsSection} icon={ListChecks}>
            {reasons.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <Check className="size-3.5" />
                {m.noReasons}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {reasons.map((code) => (
                  <li key={code} className="flex items-start gap-2 text-sm">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span className="flex flex-col">
                      <span className="font-medium">{t.verification.reasons[code]}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{code}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Alert variant={status === "SUSPICIOUS" || status === "NO_BANK_TRANSACTION" ? "destructive" : "default"}>
            <Lightbulb />
            <AlertDescription>
              <span className="font-medium">{m.suggestedAction}:</span> {suggested}
            </AlertDescription>
          </Alert>

          <Section title={m.screenshotSection} icon={Camera}>
            {record.hasBankScreenshot ? (
              canViewScreenshot ? (
                <BankScreenshot rowId={record.id} load={() => fetchScreenshot(record.id)} />
              ) : (
                <p className="text-xs text-muted-foreground">{m.screenshotRestricted}</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                {m.noScreenshot}
                {/* Matched without an image = the phone captured the text but
                    the bank app is FLAG_SECURE; say so instead of implying a bug. */}
                {bankSeen && ` · ${m.screenshotBlockedHint}`}
              </p>
            )}
          </Section>

          {canReview && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="verification-note">{t.verification.actions.noteLabel}</Label>
              <Textarea
                id="verification-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.verification.actions.notePlaceholder}
                maxLength={300}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap">
          {canReview && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={busy !== null}
                onClick={() => runReview("clear")}
              >
                {busy === "clear" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-success" />}
                {t.verification.actions.markReviewed}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={busy !== null}
                onClick={() => runReview("confirm_suspicious")}
              >
                {busy === "confirm_suspicious" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="size-3.5 text-destructive" />
                )}
                {t.verification.actions.confirmSuspicious}
              </Button>
              {bankSeen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={busy !== null}
                  onClick={() => setUnlinkOpen(true)}
                >
                  {busy === "unlink" ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
                  {t.verification.actions.unlink}
                </Button>
              )}
            </>
          )}
          {record.status === "PENDING" && (canApprove || canReject) && (
            <>
              {canApprove && (
                <Button size="sm" className="gap-1" disabled={approving || busy !== null} onClick={onApprove}>
                  {approving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  {t.common.approve}
                </Button>
              )}
              {canReject && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                  disabled={approving || busy !== null}
                  onClick={onReject}
                >
                  <X className="size-3.5" />
                  {t.common.reject}
                </Button>
              )}
            </>
          )}
        </DialogFooter>

        <ConfirmDialog
          open={unlinkOpen}
          onOpenChange={setUnlinkOpen}
          title={t.verification.actions.unlink}
          description={t.verification.actions.unlinkConfirm}
          confirmLabel={t.verification.actions.unlink}
          variant="destructive"
          loading={busy === "unlink"}
          onConfirm={async () => {
            await runReview("unlink");
            setUnlinkOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function suggestedText(
  status: BankMatchStatusView,
  isDeposit: boolean,
  s: ReturnType<typeof useLanguage>["t"]["verification"]["suggested"],
): string {
  switch (status) {
    case "MATCHED":
      return isDeposit ? s.matched : s.withdrawalMatched;
    case "SUSPICIOUS":
      return isDeposit ? s.suspicious : s.withdrawalSuspicious;
    case "PENDING_REVIEW":
      return isDeposit ? s.pendingReview : s.withdrawalPendingReview;
    case "NO_BANK_TRANSACTION":
      return isDeposit ? s.noBank : s.withdrawalNoBank;
    case "UNVERIFIED":
      return isDeposit ? s.awaiting : s.withdrawalAwaiting;
  }
}
