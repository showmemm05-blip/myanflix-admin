"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EyeOff, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { formatLocalPhone } from "@/lib/phone";
import { ApiError } from "@/services/api/apiClient";
import { depositService } from "@/services/api/depositService";
import { userService } from "@/services/api/userService";
import type { PaginationParams } from "@/types/api";
import type { Deposit } from "@/types/deposit";
import type { AppUser } from "@/types/user";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
// Money columns are 2dp — same guard as AdjustBalanceDialog (the DTO enforces
// maxDecimalPlaces: 2 server-side).
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:MM:SS" in local time, the value a `datetime-local` input expects. */
function toDateTimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeTime(time: string) {
  const [h = "00", m = "00", s = "00"] = time.split(":");
  return `${pad(Number(h))}:${pad(Number(m))}:${pad(Number(s))}`;
}

/** Live "12 Aug 2026, 06:56:28"-style preview of whatever the pickers currently hold. */
function previewDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${format(parsed, "d MMM yyyy")}, ${normalizeTime(time)}`;
}

function accountLabel(account: PaymentAccount, types: PaymentAccountType[]) {
  const typeLabel = types.find((t) => t.value === account.type)?.label ?? account.type;
  return `${typeLabel} · ${account.accountName}${account.subname ? ` (${account.subname})` : ""}`;
}

/** Small muted marker for accounts with `isActive: false` — hidden from users, still receivable. */
function HiddenBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="h-4 shrink-0 gap-1 border-muted-foreground/25 bg-muted-foreground/15 px-1.5 text-[10px] font-medium text-muted-foreground"
    >
      <EyeOff />
      {label}
    </Badge>
  );
}

function ManualDepositForm({
  accounts,
  types,
  onOpenChange,
  onSaved,
}: {
  accounts: PaymentAccount[];
  types: PaymentAccountType[];
  onOpenChange: (open: boolean) => void;
  onSaved: (created: Deposit) => void;
}) {
  const { t } = useLanguage();
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<AppUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  // Date defaults to today so the admin isn't forced to type it; only the
  // time-of-day is persisted (same storage limitation as the table cells).
  const [date, setDate] = useState(() => toDateTimeLocalValue(new Date()).slice(0, 10));
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounced server-side user search — same `search` param the users
  // endpoint supports, capped to a handful of matches for the picker.
  useEffect(() => {
    const term = searchTerm.trim();
    if (selectedUser || !term) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);
      const params: PaginationParams & { search?: string } = { search: term, limit: 8 };
      userService
        .getUsers(params)
        .then((res) => {
          if (!cancelled) setResults(res.items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchTerm, selectedUser]);

  // The trigger renders the plain label from this map; the hidden marker is
  // appended as text so it survives the Select's string-only value display.
  const accountItems = Object.fromEntries(
    accounts.map((a) => [
      a.id,
      a.isActive
        ? accountLabel(a, types)
        : `${accountLabel(a, types)} · ${t.deposits.receivingAccountCell.hidden}`,
    ]),
  );

  const parsedAmount = Number(amount);
  const validAmount =
    amount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    AMOUNT_PATTERN.test(amount.trim());
  const trimmedTime = time.trim();
  const validTime = trimmedTime.length === 0 || TIME_OF_DAY_PATTERN.test(trimmedTime);
  // The backend requires exactly 6 digits (same rule as user-submitted
  // deposits) — validate here so the admin learns the format before
  // submitting, not from a 400.
  const trimmedReference = reference.trim();
  const validReference = /^\d{6}$/.test(trimmedReference);
  const canSave =
    !!selectedUser &&
    validAmount &&
    !!destinationAccountId &&
    validReference &&
    validTime;

  const handleSave = async () => {
    if (!canSave || saving || !selectedUser || !destinationAccountId) return;
    setError(null);
    setSaving(true);
    try {
      // No separate payment-method field: it follows the picked Destination
      // Account's type, stored as the type's LABEL like user-submitted
      // deposits (the table's logo/subname lookup matches on label).
      const destinationAccount = accounts.find((a) => a.id === destinationAccountId);
      const created = await depositService.createManualDeposit({
        userId: selectedUser.id,
        amount: parsedAmount,
        paymentMethod:
          types.find((ty) => ty.value === destinationAccount?.type)?.label ??
          destinationAccount?.type ??
          "",
        reference: trimmedReference,
        destinationPaymentAccountId: destinationAccountId,
        receivingTransactionTime: trimmedTime ? normalizeTime(trimmedTime) : undefined,
      });
      onSaved(created);
      toast.success(t.deposits.manualDeposit.savedToast, {
        description: t.deposits.manualDeposit.savedDescription(selectedUser.name),
      });
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
        <DialogTitle>{t.deposits.manualDeposit.title}</DialogTitle>
        <DialogDescription>{t.deposits.manualDeposit.description}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-deposit-user">{t.deposits.manualDeposit.userLabel}</Label>
          {selectedUser ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/20 px-2.5 py-1.5">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{selectedUser.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatLocalPhone(selectedUser.phone) ?? "—"}
                </span>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={saving}
                onClick={() => setSelectedUser(null)}
                aria-label={t.deposits.manualDeposit.clearUserAriaLabel}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="manual-deposit-user"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.deposits.manualDeposit.userSearchPlaceholder}
                disabled={saving}
              />
              {searchTerm.trim().length > 0 && (
                <div className="flex max-h-48 flex-col overflow-y-auto rounded-lg border border-border">
                  {searching || results === null ? (
                    <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t.deposits.manualDeposit.userSearching}
                    </div>
                  ) : results.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-muted-foreground">
                      {t.deposits.manualDeposit.userNoResults}
                    </p>
                  ) : (
                    results.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchTerm("");
                          setResults(null);
                        }}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/60"
                      >
                        <span className="truncate text-sm font-medium">{user.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatLocalPhone(user.phone) ?? "—"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-deposit-amount">{t.deposits.manualDeposit.amountLabel}</Label>
          <Input
            id="manual-deposit-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.deposits.manualDeposit.amountPlaceholder}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t.deposits.manualDeposit.destinationAccountLabel}</Label>
          <Select
            items={accountItems}
            value={destinationAccountId ?? ""}
            onValueChange={(v) => v && setDestinationAccountId(v as string)}
          >
            <SelectTrigger className="w-full" disabled={saving}>
              <SelectValue placeholder={t.deposits.manualDeposit.destinationAccountPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-1.5">
                    {accountLabel(a, types)}
                    {!a.isActive && <HiddenBadge label={t.deposits.receivingAccountCell.hidden} />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-deposit-reference">{t.deposits.manualDeposit.referenceLabel}</Label>
          <Input
            id="manual-deposit-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t.deposits.manualDeposit.referencePlaceholder}
            disabled={saving}
            className="font-mono"
          />
          <p
            className={
              reference.length > 0 && !validReference
                ? "text-[11px] text-warning"
                : "text-[11px] text-muted-foreground"
            }
          >
            {t.deposits.manualDeposit.referenceHint}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="manual-deposit-time">{t.deposits.manualDeposit.dateTimeLabel}</Label>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const now = toDateTimeLocalValue(new Date());
                setDate(now.slice(0, 10));
                setTime(now.slice(11));
              }}
              className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {t.deposits.manualDeposit.now}
            </button>
          </div>
          {/* Time above date — the time is what actually gets stored, so it
              leads; the date is context. */}
          <div className="flex flex-col gap-1.5">
            <Input
              id="manual-deposit-time"
              type="time"
              step={1}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={saving}
              className="[color-scheme:dark]"
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              className="[color-scheme:dark]"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {previewDateTime(date, time) ?? t.deposits.manualDeposit.pickDateTime}
            {t.deposits.manualDeposit.onlyTimeStored}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.deposits.manualDeposit.save}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Admin records a deposit that arrived outside the normal request flow — it is
 * created already APPROVED: the user's wallet is credited and the picked
 * destination account's ledger/balance updated in one backend transaction.
 * Mirrors the AdjustBalanceDialog pattern: the form is remounted per open so
 * its state always starts fresh.
 */
export function ManualDepositDialog({
  accounts,
  types,
  open,
  onOpenChange,
  onSaved,
}: {
  accounts: PaymentAccount[];
  types: PaymentAccountType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (created: Deposit) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md">
        {open && (
          <ManualDepositForm
            accounts={accounts}
            types={types}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
