"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { format } from "date-fns";
import Image from "next/image";
import { AlertCircle, Check, Clock, ImageIcon, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";
import { depositService } from "@/services/api/depositService";
import type { Deposit } from "@/types/deposit";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:MM:SS" in local time, the value a `datetime-local` input expects. */
function toDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Only `receivingTransactionTime` (time-of-day, e.g. "06:56:28") is actually
 * persisted today — the backend has no date column yet. Date and time are
 * kept as two separate native inputs (rather than one `datetime-local`)
 * specifically so the date can be pre-filled while the time is left
 * genuinely blank — a single `datetime-local` input's value is all-or-
 * nothing, so there's no way to default just one half of it.
 */
function initialDateValue(savedTime: string | null, approvedAt: string | null) {
  // Nothing saved yet — default to today so the admin isn't forced to type
  // it every time; they can still change it.
  if (!savedTime) return toDateTimeLocalValue(new Date()).slice(0, 10);
  // Already saved — pair it with the deposit's approval date (the best
  // available proxy for "when this probably happened"), exactly as before.
  const day = approvedAt ? new Date(approvedAt) : new Date();
  return toDateTimeLocalValue(day).slice(0, 10);
}

/** Blank until the admin fills it in (or uses "Now") — unchanged from before. */
function initialTimeValue(savedTime: string | null) {
  return savedTime ?? "";
}

function normalizeTime(time: string) {
  const [h = "00", m = "00", s = "00"] = time.split(":");
  return `${pad(Number(h))}:${pad(Number(m))}:${pad(Number(s))}`;
}

function formatSavedDisplay(savedTime: string | null, approvedAt: string | null) {
  if (!savedTime) return null;
  const datePart = approvedAt ? format(new Date(approvedAt), "d MMM yyyy") : null;
  return datePart ? `${datePart}, ${savedTime}` : savedTime;
}

/** Live "12 Aug 2026, 06:56:28"-style preview of whatever the pickers currently hold. */
function previewDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${format(parsed, "d MMM yyyy")}, ${normalizeTime(time)}`;
}

/**
 * A plain admin-typed RECORD of the account the user says they sent the
 * deposit FROM — not a lookup against our own configured Payment Methods
 * catalog, and not a claim that we know which of our accounts received it
 * (that reconciliation, if any, happens elsewhere). Deliberately has no
 * account picker/subname — those only make sense for OUR own accounts (see
 * withdrawals' TransferAccountCell), which this is explicitly not. UI is
 * otherwise kept identical to TransferAccountCell for a consistent Finance
 * experience: same collapsed "Not added" indicator, card layout, field
 * grouping, and date/time entry pattern.
 *
 * Transaction date & time: only the time-of-day portion is persisted today
 * (see initialDateTimeValue/formatSavedDisplay) — same limitation as
 * withdrawals until a real DateTime column lands.
 */
export function UserDepositAccountCell({
  deposit,
  accounts,
  types,
  onSaved,
}: {
  deposit: Deposit;
  accounts: PaymentAccount[];
  types: PaymentAccountType[];
  onSaved: (updated: Deposit) => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(deposit.receivingAccountName ?? "");
  const [number, setNumber] = useState(deposit.receivingAccountNumber ?? "");
  const [date, setDate] = useState(
    initialDateValue(deposit.receivingTransactionTime, deposit.approvedAt),
  );
  const [time, setTime] = useState(initialTimeValue(deposit.receivingTransactionTime));
  const [saving, setSaving] = useState(false);

  if (deposit.status !== "APPROVED") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const hasSavedAccount = !!(deposit.receivingAccountName || deposit.receivingAccountType);
  // The account TYPE is no longer entered here — it follows the linked
  // Destination Account, which is also where the logo comes from (falling
  // back to whatever type an older record stored).
  const destinationType =
    accounts.find((a) => a.id === deposit.receivingPaymentAccountId)?.type ?? null;
  const logoType = destinationType ?? deposit.receivingAccountType;
  const logoUrl = types.find((t) => t.value === logoType)?.logoUrl ?? null;
  const canSave =
    name.trim().length > 0 &&
    number.trim().length > 0 &&
    date.trim().length > 0 &&
    TIME_OF_DAY_PATTERN.test(time.trim());

  const startEdit = () => {
    setName(deposit.receivingAccountName ?? "");
    setNumber(deposit.receivingAccountNumber ?? "");
    setDate(initialDateValue(deposit.receivingTransactionTime, deposit.approvedAt));
    setTime(initialTimeValue(deposit.receivingTransactionTime));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const updated = await depositService.updateReceivingAccount(deposit.id, {
        // Type follows the Destination Account; omitted (stored value kept)
        // when no destination is linked yet — PATCH semantics.
        ...(destinationType ? { receivingAccountType: destinationType } : {}),
        receivingAccountName: name.trim(),
        receivingAccountNumber: number.trim(),
        receivingTransactionTime: normalizeTime(time.trim()),
        // Typed manually — the record no longer matches a catalog pick, so
        // the stale subname is cleared explicitly. Everything omitted (the
        // catalog account link, a stored transaction code) stays untouched
        // under the endpoint's PATCH semantics.
        receivingAccountSubname: null,
      });
      onSaved(updated);
      toast.success(t.deposits.userAccountCell.savedToast);
      setEditing(false);
    } catch (err) {
      toast.error(t.deposits.userAccountCell.saveFailedToast, {
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
        {t.deposits.userAccountCell.notAdded}
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
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.deposits.userAccountCell.heading}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t.deposits.userAccountCell.subtext}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">{t.deposits.userAccountCell.accountNameLabel}</Label>
          <Input
            autoFocus={editing}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.deposits.userAccountCell.accountNamePlaceholder}
            disabled={saving}
            className="h-7 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">{t.deposits.userAccountCell.accountNumberLabel}</Label>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={t.deposits.userAccountCell.accountNumberPlaceholder}
            disabled={saving}
            className="h-7 font-mono text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-normal text-muted-foreground">{t.deposits.userAccountCell.dateTimeLabel}</Label>
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
              {t.deposits.userAccountCell.now}
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
            {previewDateTime(date, time) ?? t.deposits.userAccountCell.pickDateTime}{t.deposits.userAccountCell.onlyTimeStored}
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
            title={logoType ?? undefined}
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={logoType ?? ""} width={20} height={20} className="size-full object-cover" unoptimized />
            ) : (
              <ImageIcon className="size-2.5 text-muted-foreground" />
            )}
          </div>
          {deposit.receivingAccountName && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {deposit.receivingAccountName}
            </span>
          )}
        </div>
        <span className="font-mono text-muted-foreground">{deposit.receivingAccountNumber}</span>
        {deposit.receivingTransactionTime && (
          <span className="inline-flex items-center gap-1 text-muted-foreground" title={t.deposits.userAccountCell.onlyTimeStoredTitle}>
            <Clock className="size-2.5 shrink-0" />
            {formatSavedDisplay(deposit.receivingTransactionTime, deposit.approvedAt)}
          </span>
        )}
      </div>
      <Button size="icon-sm" variant="ghost" onClick={startEdit} aria-label={t.deposits.userAccountCell.editAriaLabel}>
        <Pencil className="size-3" />
      </Button>
    </div>
  );
}
