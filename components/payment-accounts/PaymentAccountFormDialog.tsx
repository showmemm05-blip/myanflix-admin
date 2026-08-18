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
import { useLanguage } from "@/lib/context/language-context";

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
  const { t } = useLanguage();
  const isEdit = !!account;
  const [type, setType] = useState(account?.type ?? types[0]?.value ?? "");
  const [subname, setSubname] = useState(account?.subname ?? "");
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
        subname: subname.trim() || undefined,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName.trim() || undefined,
        note: note.trim() || undefined,
      };
      const saved = isEdit
        ? await paymentAccountService.updateAccount(account.id, values)
        : await paymentAccountService.createAccount(values);
      onSaved(saved);
      toast.success(
        isEdit ? t.paymentAccounts.formDialog.updatedToast : t.paymentAccounts.formDialog.createdToast,
        {
          description: t.paymentAccounts.formDialog.savedDescription(accountName.trim()),
        },
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
          {isEdit ? t.paymentAccounts.formDialog.editTitle : t.paymentAccounts.formDialog.addTitle}
        </DialogTitle>
        <DialogDescription>
          {isEdit ? t.paymentAccounts.formDialog.editDescription : t.paymentAccounts.formDialog.addDescription}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>{t.paymentAccounts.formDialog.paymentMethodLabel}</Label>
          <Select items={typeItems} value={type} onValueChange={(v) => v && setType(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((accountType) => (
                <SelectItem key={accountType.value} value={accountType.value}>
                  {accountType.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-subname">{t.paymentAccounts.formDialog.subnameLabel}</Label>
          <Input
            id="payment-account-subname"
            value={subname}
            onChange={(e) => setSubname(e.target.value)}
            placeholder={t.paymentAccounts.formDialog.subnamePlaceholder}
          />
          <p className="text-xs text-muted-foreground">
            {t.paymentAccounts.formDialog.subnameHint(
              typeItems[type] ?? t.paymentAccounts.formDialog.thisMethodFallback,
            )}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-name">{t.paymentAccounts.formDialog.accountNameLabel}</Label>
          <Input
            id="payment-account-name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder={t.paymentAccounts.formDialog.accountNamePlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-number">{t.paymentAccounts.formDialog.accountNumberLabel}</Label>
          <Input
            id="payment-account-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder={t.paymentAccounts.formDialog.accountNumberPlaceholder}
          />
        </div>
        {requiresBankName && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-account-bank-name">{t.paymentAccounts.formDialog.bankNameLabel}</Label>
            <Input
              id="payment-account-bank-name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder={t.paymentAccounts.formDialog.bankNamePlaceholder}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-account-note">{t.paymentAccounts.formDialog.noteLabel}</Label>
          <Textarea
            id="payment-account-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.paymentAccounts.formDialog.notePlaceholder}
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
          {isEdit ? t.paymentAccounts.formDialog.editSave : t.paymentAccounts.formDialog.addSave}
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
