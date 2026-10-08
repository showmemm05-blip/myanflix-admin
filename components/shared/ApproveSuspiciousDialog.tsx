"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";

/** The typed amount next to what the bank saw (M-15/M-7) — only passed when they differ. */
export interface AmountMismatch {
  typed: number;
  bank: number;
}

/** What the admin decided about a mismatching amount: credit the BANK amount, and why. */
export interface AmountOverrideDecision {
  reason: string;
}

/**
 * The "are you sure?" that sits in front of Approve when the fraud checks
 * flagged the row SUSPICIOUS. The money decision is still the admin's — this
 * only makes it deliberate, and captures WHY as a note. The approve routes
 * take no body, so the page records the note through the verification
 * review endpoint (`confirm_suspicious`, audited with the note) and then
 * approves — the field is only offered when the admin holds EDIT.
 *
 * M-15/M-7 (deposits): when the bank saw a DIFFERENT amount than the user
 * typed, the server refuses a plain approve. The dialog then shows both
 * amounts, a checkbox "credit the bank amount instead" and a REQUIRED
 * reason; Approve stays disabled until both are given, and the decision
 * travels in the approve request itself (audited server-side).
 *
 * Not the shared ConfirmDialog because that one has no slot for a field.
 */
export function ApproveSuspiciousDialog({
  kind,
  open,
  onOpenChange,
  loading,
  showNote,
  amountMismatch = null,
  onConfirm,
}: {
  kind: "deposit" | "withdrawal";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  /** DEPOSITS.EDIT / WITHDRAWALS.EDIT — without it the note could not be recorded, so it is not asked for. */
  showNote: boolean;
  /** Deposits only: set when the bank's amount differs from the typed one. */
  amountMismatch?: AmountMismatch | null;
  onConfirm: (note: string, amountOverride?: AmountOverrideDecision) => void;
}) {
  const { t } = useLanguage();
  const a = t.verification.actions;
  const [note, setNote] = useState("");
  const [creditBankAmount, setCreditBankAmount] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const needsOverride = amountMismatch !== null;
  const overrideReady = !needsOverride || (creditBankAmount && overrideReason.trim().length > 0);

  const reset = () => {
    setNote("");
    setCreditBankAmount(false);
    setOverrideReason("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "deposit" ? a.approveSuspiciousTitle : a.approveSuspiciousWithdrawalTitle}</DialogTitle>
          <DialogDescription>
            {kind === "deposit" ? a.approveSuspiciousDescription : a.approveSuspiciousWithdrawalDescription}
          </DialogDescription>
        </DialogHeader>

        {amountMismatch && (
          <div className="flex flex-col gap-3">
            <Alert variant="destructive">
              <AlertDescription>
                {a.amountMismatchNotice(formatKyat(amountMismatch.typed), formatKyat(amountMismatch.bank))}
              </AlertDescription>
            </Alert>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="approve-credit-bank-amount"
                checked={creditBankAmount}
                disabled={loading}
                onCheckedChange={(next) => setCreditBankAmount(next === true)}
              />
              <Label htmlFor="approve-credit-bank-amount" className="font-normal leading-snug">
                {a.creditBankAmountLabel(formatKyat(amountMismatch.bank))}
              </Label>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="approve-override-reason">{a.overrideReasonLabel}</Label>
              <Textarea
                id="approve-override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={a.overrideReasonPlaceholder}
                maxLength={300}
                rows={2}
                disabled={!creditBankAmount || loading}
              />
            </div>
          </div>
        )}

        {showNote && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="approve-suspicious-note">{a.noteLabel}</Label>
            <Textarea
              id="approve-suspicious-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={a.notePlaceholder}
              maxLength={300}
              rows={2}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              onConfirm(note, needsOverride ? { reason: overrideReason.trim() } : undefined)
            }
            disabled={loading || !overrideReady}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {needsOverride ? a.approveBankAmount : a.approveAnyway}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
