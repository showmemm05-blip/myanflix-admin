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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/services/api/apiClient";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

function PaymentAccountForm({
  account,
  types,
  onOpenChange,
  onSaved,
}: {
  account: PaymentAccount | null;
  types: PaymentAccountType[];
  onOpenChange: (open: boolean) => void;
  onSaved: (account: PaymentAccount) => void;
}) {
  const isEdit = !!account;
  const [type, setType] = useState(account?.type ?? types[0]?.value ?? "");
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [note, setNote] = useState(account?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedType = types.find((t) => t.value === type);
  const requiresBankName = selectedType?.requiresBankName ?? false;
  const typeItems = Object.fromEntries(types.map((t) => [t.value, t.label]));

  const canSave =
    !!type &&
    accountName.trim().length > 0 &&
    accountNumber.trim().length > 0 &&
    (!requiresBankName || bankName.trim().length > 0);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const values = {
        type,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName.trim() || undefined,
        note: note.trim() || undefined,
      };
      const saved = isEdit
        ? await paymentAccountService.updateAccount(account.id, values)
        : await paymentAccountService.createAccount(values);
      onSaved(saved);
      toast.success(isEdit ? "Payment account updated" : "Payment account created", {
        description: `${accountName.trim()} is ready to receive deposits.`,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit payment account" : "Add payment account"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the destination users send deposits to."
            : "Add a new destination users can send deposits to."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>Payment method</Label>
          <Select items={typeItems} value={type} onValueChange={(v) => v && setType(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-name">Account name</Label>
          <Input
            id="payment-account-name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="MyanFlix Co., Ltd."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-number">Account number / phone number</Label>
          <Input
            id="payment-account-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="09xxxxxxxxx"
          />
        </div>
        {requiresBankName && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-account-bank-name">Bank name</Label>
            <Input
              id="payment-account-bank-name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="KBZ Bank"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-note">Note (optional)</Label>
          <Textarea
            id="payment-account-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shown to users alongside this account, if needed."
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Add account"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PaymentAccountFormDialog({
  account,
  types,
  open,
  onOpenChange,
  onSaved,
}: {
  account: PaymentAccount | null;
  types: PaymentAccountType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (account: PaymentAccount) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <PaymentAccountForm
            key={account?.id ?? "create"}
            account={account}
            types={types}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
