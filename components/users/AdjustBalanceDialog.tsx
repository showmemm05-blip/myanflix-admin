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
import { cn } from "@/lib/utils";
import { formatKyat } from "@/lib/currency";
import { ApiError } from "@/services/api/apiClient";
import { userService } from "@/services/api/userService";
import type { AppUser } from "@/types/user";
import type { WalletAdjustmentDirection, WalletAdjustmentResult } from "@/types/wallet-adjustment";
import { toast } from "sonner";
import { useLanguage } from "@/lib/context/language-context";

function AdjustBalanceForm({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AppUser;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: WalletAdjustmentResult) => void;
}) {
  const { t } = useLanguage();
  const [direction, setDirection] = useState<WalletAdjustmentDirection>("CREDIT");
  // One key per dialog OPEN, not per render: the parent only mounts this form
  // while the dialog is open, so this initializer runs exactly once per open.
  // Retrying a failed submit reuses the key (the server's duplicate guard can
  // then replay instead of double-charging); reopening mints a fresh one.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedAmount = Number(amount);
  // Money columns are 2dp — also rejects sub-cent input the backend would
  // round inconsistently (the DTO enforces maxDecimalPlaces: 2 server-side).
  const validAmount =
    amount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    /^\d+(\.\d{1,2})?$/.test(amount.trim());
  // The backend enforces this too (wallets can never go negative) — the client
  // check just saves a guaranteed-to-fail round trip.
  const insufficient = direction === "DEBIT" && validAmount && parsedAmount > user.balance;
  const canSave = validAmount && reason.trim().length > 0 && !insufficient;
  const newBalance = validAmount
    ? direction === "CREDIT"
      ? user.balance + parsedAmount
      : user.balance - parsedAmount
    : null;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await userService.adjustBalance(user.id, {
        direction,
        amount: parsedAmount,
        reason: reason.trim(),
        idempotencyKey,
      });
      onSaved(result);
      toast.success(
        direction === "CREDIT"
          ? t.walletAdjustments.dialog.creditedToast
          : t.walletAdjustments.dialog.debitedToast,
        { description: t.walletAdjustments.dialog.savedDescription(user.name) },
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
          {direction === "CREDIT"
            ? t.walletAdjustments.dialog.addTitle
            : t.walletAdjustments.dialog.deductTitle}
        </DialogTitle>
        <DialogDescription>{t.walletAdjustments.dialog.descriptionFor(user.name)}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs
          value={direction}
          onValueChange={(v) => v && setDirection(v as WalletAdjustmentDirection)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="CREDIT" className="flex-1">
              {t.walletAdjustments.dialog.addTab}
            </TabsTrigger>
            <TabsTrigger value="DEBIT" className="flex-1">
              {t.walletAdjustments.dialog.deductTab}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adjust-amount">{t.walletAdjustments.dialog.amountLabel}</Label>
          <Input
            id="adjust-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.walletAdjustments.dialog.amountPlaceholder}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/20 px-2.5 py-2 text-xs tabular-nums">
          <span className="text-muted-foreground">{t.walletAdjustments.dialog.balancePreview}</span>
          <span>
            {formatKyat(user.balance)}
            <span className="mx-1 text-muted-foreground">→</span>
            <span
              className={cn(
                "font-semibold",
                newBalance === null && "text-muted-foreground",
                newBalance !== null && direction === "CREDIT" && "text-income",
                newBalance !== null && direction === "DEBIT" && "text-outgoing",
              )}
            >
              {formatKyat(newBalance ?? user.balance)}
            </span>
          </span>
        </div>

        {insufficient && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-2.5 py-2 text-xs text-warning">
            <AlertTriangle className="size-3.5 shrink-0 translate-y-0.5" />
            <span>{t.walletAdjustments.dialog.insufficientBalance}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adjust-reason">{t.walletAdjustments.dialog.reasonLabel}</Label>
          <Textarea
            id="adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.walletAdjustments.dialog.reasonPlaceholder}
            rows={3}
            disabled={saving}
          />
          <p className="text-[11px] text-muted-foreground">{t.walletAdjustments.dialog.reasonNote}</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.walletAdjustments.dialog.save}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Super-Admin-only manual wallet credit/debit for a user, mirroring the
 * payment-accounts RecordTransactionDialog pattern: the form is remounted per
 * open so its state — including the per-open idempotency key — always starts
 * fresh.
 */
export function AdjustBalanceDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: AppUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: WalletAdjustmentResult) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <AdjustBalanceForm user={user} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}
