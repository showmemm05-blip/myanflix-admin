"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { AlertCircle, Check, Clock, Hash, ImageIcon, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import {
  TIME_OF_DAY_PATTERN,
  formatSavedDisplay,
  initialDateValue,
  initialTimeValue,
  normalizeTime,
  previewDateTime,
  toDateTimeLocalValue,
} from "@/lib/datetime-local";
import { withdrawalService } from "@/services/api/withdrawalService";
import type { Withdrawal } from "@/types/withdrawal";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

const TRANSACTION_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

function accountLabel(account: PaymentAccount) {
  return account.subname ? `${account.type} — ${account.subname}` : account.type;
}

/**
 * Records which of OUR accounts sent this payout — entirely separate from
 * `accountType`/`accountName`/`accountNumber` (the user's own destination
 * account, rendered read-only in the neighboring column) and never touches
 * status/wallet/ledger. Edits inline in the table row instead of a modal so
 * this reads as a quick accounting entry, not a separate form workflow.
 *
 * The dropdown lists every configured payment account by its `subname` —
 * that's the whole point of subname (see PaymentAccount.subname) — so the
 * admin can pick e.g. "KBZPay — Backup Account" in one click instead of
 * retyping the account name/number by hand. Picking one just pre-fills the
 * fields below; they stay freely editable in case the exact account isn't
 * in the catalog or needs a one-off correction.
 *
 * Transaction date & time uses a native datetime-local picker so the admin
 * enters (and later re-reads) it as a real date+time, not a raw string —
 * this is UI-only prep for a future proper DateTime column: only the
 * time-of-day portion is actually sent to the backend today, paired with
 * the withdrawal's approval date purely for display when reopening an
 * existing entry (see initialDateTimeValue/formatSavedDisplay above).
 */
export function TransferAccountCell({
  withdrawal,
  accounts,
  types,
  onSaved,
}: {
  withdrawal: Withdrawal;
  accounts: PaymentAccount[];
  types: PaymentAccountType[];
  onSaved: (updated: Withdrawal) => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    withdrawal.transferPaymentAccountId,
  );
  const [type, setType] = useState(withdrawal.transferAccountType ?? "");
  const [subname, setSubname] = useState(withdrawal.transferAccountSubname ?? "");
  const [name, setName] = useState(withdrawal.transferAccountName ?? "");
  const [number, setNumber] = useState(withdrawal.transferAccountNumber ?? "");
  const [code, setCode] = useState(withdrawal.transferTransactionCode ?? "");
  const [date, setDate] = useState(
    initialDateValue(withdrawal.transferTransactionTime, withdrawal.approvedAt),
  );
  const [time, setTime] = useState(initialTimeValue(withdrawal.transferTransactionTime));
  const [saving, setSaving] = useState(false);

  if (withdrawal.status !== "APPROVED") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const hasSavedAccount = !!withdrawal.transferAccountType;
  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, accountLabel(a)]));
  const logoUrl = types.find((t) => t.value === withdrawal.transferAccountType)?.logoUrl ?? null;
  const canSave =
    type.trim().length > 0 &&
    name.trim().length > 0 &&
    number.trim().length > 0 &&
    TRANSACTION_CODE_PATTERN.test(code.trim()) &&
    date.trim().length > 0 &&
    TIME_OF_DAY_PATTERN.test(time.trim());

  const startEdit = () => {
    setSelectedAccountId(withdrawal.transferPaymentAccountId);
    setType(withdrawal.transferAccountType ?? "");
    setSubname(withdrawal.transferAccountSubname ?? "");
    setName(withdrawal.transferAccountName ?? "");
    setNumber(withdrawal.transferAccountNumber ?? "");
    setCode(withdrawal.transferTransactionCode ?? "");
    setDate(initialDateValue(withdrawal.transferTransactionTime, withdrawal.approvedAt));
    setTime(initialTimeValue(withdrawal.transferTransactionTime));
    setEditing(true);
  };

  const handlePickAccount = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    setSelectedAccountId(account.id);
    setType(account.type);
    setSubname(account.subname ?? "");
    setName(account.accountName);
    setNumber(account.accountNumber);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const updated = await withdrawalService.updateTransferAccount(withdrawal.id, {
        transferAccountType: type.trim(),
        transferAccountSubname: subname.trim() || undefined,
        transferAccountName: name.trim(),
        transferAccountNumber: number.trim(),
        transferTransactionCode: code.trim(),
        transferTransactionTime: normalizeTime(time.trim()),
        paymentAccountId: selectedAccountId,
      });
      onSaved(updated);
      toast.success(t.withdrawals.transferAccountCell.savedToast);
      setEditing(false);
    } catch (err) {
      toast.error(t.withdrawals.transferAccountCell.saveFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  };

  if (!hasSavedAccount && !editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-warning/25 bg-warning/15 px-2 py-1 text-[11px] font-medium text-warning transition-colors hover:bg-warning/20"
      >
        <AlertCircle className="size-3 shrink-0" />
        {t.withdrawals.transferAccountCell.notAdded}
        <span className="inline-flex items-center gap-0.5 text-primary">
          <Plus className="size-3" />
          {t.common.add}
        </span>
      </button>
    );
  }

  if (editing) {
    return (
      <div
        className="flex w-64 flex-col gap-2 rounded-md border border-border bg-secondary/10 p-2.5"
        onKeyDown={handleKeyDown}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t.withdrawals.transferAccountCell.heading}
        </p>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">{t.withdrawals.transferAccountCell.quickFillLabel}</Label>
          <Select
            items={accountItems}
            value={selectedAccountId ?? ""}
            onValueChange={(v) => v && handlePickAccount(v as string)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder={t.withdrawals.transferAccountCell.quickFillPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {accountLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* No type field — the account TYPE follows the picked account above. */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">{t.withdrawals.transferAccountCell.txnCodeLabel}</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6))}
            placeholder={t.withdrawals.transferAccountCell.txnCodePlaceholder}
            disabled={saving}
            className="h-7 font-mono text-xs"
          />
        </div>
        {code.trim().length > 0 && !TRANSACTION_CODE_PATTERN.test(code.trim()) && (
          <p className="-mt-1 text-[11px] text-destructive">{t.withdrawals.transferAccountCell.codeLengthError}</p>
        )}

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">{t.withdrawals.transferAccountCell.accountNameLabel}</Label>
          <Input
            autoFocus={editing}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.withdrawals.transferAccountCell.accountNamePlaceholder}
            disabled={saving}
            className="h-7 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">{t.withdrawals.transferAccountCell.accountNumberLabel}</Label>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={t.withdrawals.transferAccountCell.accountNumberPlaceholder}
            disabled={saving}
            className="h-7 font-mono text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-normal text-muted-foreground">{t.withdrawals.transferAccountCell.dateTimeLabel}</Label>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const now = toDateTimeLocalValue(new Date());
                setDate(now.slice(0, 10));
                setTime(now.slice(11));
              }}
              className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {t.withdrawals.transferAccountCell.now}
            </button>
          </div>
          {/* Time above date — the time is what actually gets stored. */}
          <div className="flex flex-col gap-1.5">
            <Input
              type="time"
              step={1}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={saving}
              className="h-7 text-xs [color-scheme:dark]"
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              className="h-7 text-xs [color-scheme:dark]"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {previewDateTime(date, time) ?? t.withdrawals.transferAccountCell.pickDateTime}{t.withdrawals.transferAccountCell.onlyTimeStored}
          </p>
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          <Button size="sm" className="h-7 flex-1 gap-1 text-xs" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {t.common.save}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={saving} onClick={() => setEditing(false)}>
            <X className="size-3.5" />
            {t.common.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col gap-1 py-0.5 text-xs leading-tight">
        <div className="flex items-center gap-1.5">
          <div
            className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40"
            title={withdrawal.transferAccountType ?? undefined}
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={withdrawal.transferAccountType ?? ""} width={20} height={20} className="size-full object-cover" unoptimized />
            ) : (
              <ImageIcon className="size-2.5 text-muted-foreground" />
            )}
          </div>
          {(withdrawal.transferAccountSubname || withdrawal.transferAccountName) && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {withdrawal.transferAccountSubname || withdrawal.transferAccountName}
            </span>
          )}
        </div>
        {/* Masked render-only; the full number stays a hover away. The
            transactionCode below stays FULL — it's a 6-char op reference the
            admin reads out, not a sensitive account. Edit inputs stay raw. */}
        <span className="font-mono text-muted-foreground">
          {withdrawal.transferAccountNumber}
        </span>
        {withdrawal.transferTransactionCode && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Hash className="size-2.5 shrink-0" />
            <span className="font-mono">{withdrawal.transferTransactionCode}</span>
          </span>
        )}
        {withdrawal.transferTransactionTime && (
          <span className="inline-flex items-center gap-1 text-muted-foreground" title={t.withdrawals.transferAccountCell.onlyTimeStoredTitle}>
            <Clock className="size-2.5 shrink-0" />
            {formatSavedDisplay(withdrawal.transferTransactionTime, withdrawal.approvedAt)}
          </span>
        )}
      </div>
      <Button size="icon-sm" variant="ghost" onClick={startEdit} aria-label={t.withdrawals.transferAccountCell.editAriaLabel}>
        <Pencil className="size-3" />
      </Button>
    </div>
  );
}
