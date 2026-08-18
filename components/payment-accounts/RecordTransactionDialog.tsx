"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKyat } from "@/lib/currency";
import { ApiError } from "@/services/api/apiClient";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type { PaymentAccount } from "@/types/payment-account";
import type { PaymentAccountTransactionEntry } from "@/types/payment-account-transaction";
import { toast } from "sonner";
import { useLanguage } from "@/lib/context/language-context";

type Direction = "credit" | "debit";

function RecordTransactionForm({
  account,
  initialDirection,
  onOpenChange,
  onSaved,
}: {
  account: PaymentAccount;
  initialDirection: Direction;
  onOpenChange: (open: boolean) => void;
  onSaved: (account: PaymentAccount, entry: PaymentAccountTransactionEntry) => void;
}) {
  const { t } = useLanguage();
  // Only the starting tab — the user can still switch inside the dialog. The
  // parent remounts this form per open, so a later open always re-reads it.
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [amount, setAmount] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const type = direction === "credit" ? "MANUAL_CREDIT" : "MANUAL_DEBIT";
  const parsedAmount = Number(amount);
  const canSave = amount.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const wouldGoNegative = direction === "debit" && canSave && parsedAmount > account.balance;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await paymentAccountService.recordTransaction(account.id, {
        type,
        amount: parsedAmount,
        referenceCode: referenceCode.trim() || undefined,
        note: note.trim() || undefined,
      });
      onSaved(result.account, result.entry);
      toast.success(
        direction === "credit"
          ? t.paymentAccountLedger.recordDialog.creditedToast
          : t.paymentAccountLedger.recordDialog.debitedToast,
        { description: t.paymentAccountLedger.recordDialog.savedDescription(account.accountName) },
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.somethingWentWrong);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {direction === "credit"
            ? t.paymentAccountLedger.recordDialog.addTitle
            : t.paymentAccountLedger.recordDialog.removeTitle}
        </DialogTitle>
        <DialogDescription>{account.accountName}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={direction} onValueChange={(v) => v && setDirection(v as Direction)}>
          <TabsList className="w-full">
            <TabsTrigger value="credit" className="flex-1">
              {t.paymentAccountLedger.recordDialog.addTab}
            </TabsTrigger>
            <TabsTrigger value="debit" className="flex-1">
              {t.paymentAccountLedger.recordDialog.removeTab}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transaction-amount">{t.paymentAccountLedger.recordDialog.amountLabel}</Label>
          <Input
            id="transaction-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.paymentAccountLedger.recordDialog.amountPlaceholder}
          />
        </div>

        {wouldGoNegative && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-2.5 py-2 text-xs text-warning">
            <AlertTriangle className="size-3.5 shrink-0 translate-y-0.5" />
            <span className="tabular-nums">
              {t.paymentAccountLedger.recordDialog.negativeBalanceWarning} ({formatKyat(account.balance)} →{" "}
              {formatKyat(account.balance - parsedAmount)})
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transaction-reference">{t.paymentAccountLedger.recordDialog.referenceCodeLabel}</Label>
          <Input
            id="transaction-reference"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            placeholder={t.paymentAccountLedger.recordDialog.referenceCodePlaceholder}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transaction-note">{t.paymentAccountLedger.recordDialog.noteLabel}</Label>
          <Textarea
            id="transaction-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.paymentAccountLedger.recordDialog.notePlaceholder}
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.paymentAccountLedger.recordDialog.save}
        </Button>
      </DialogFooter>
    </>
  );
}

export function RecordTransactionDialog({
  account,
  mode = "add",
  open,
  onOpenChange,
  onSaved,
}: {
  account: PaymentAccount | null;
  /** Which tab to open on — set from whichever button the admin pressed. */
  mode?: "add" | "remove";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (account: PaymentAccount, entry: PaymentAccountTransactionEntry) => void;
}) {
  const direction: Direction = mode === "remove" ? "debit" : "credit";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && account && (
          // Keyed on the mode too, so opening "Remove money" after "Add money"
          // starts on the right tab instead of reusing the mounted form's state.
          <RecordTransactionForm
            key={`${account.id}:${direction}`}
            account={account}
            initialDirection={direction}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
