"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { AlertCircle, Check, EyeOff, ImageIcon, Loader2, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { depositService } from "@/services/api/depositService";
import type { Deposit } from "@/types/deposit";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

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

/**
 * Picks which of OUR catalog payment accounts this deposit's money actually
 * landed in (`receivingPaymentAccountId`) — the backend re-links the ledger
 * (reversal + forward entries) on save. Entirely separate from the free-text
 * customer-FROM record managed by the neighboring UserDepositAccountCell:
 * saving here passes those fields through exactly as stored so the two cells
 * never clobber each other.
 *
 * Lists EVERY configured account, including ones hidden from users
 * (`isActive: false`) — money can still legitimately arrive into a hidden
 * account, so they stay pickable here and are just marked with a muted badge.
 * Mirrors the withdrawals TransferAccountCell look/UX: same "Not added"
 * collapsed indicator, inline edit card, and APPROVED-only gating.
 */
export function ReceivingAccountCell({
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    deposit.receivingPaymentAccountId,
  );
  const [saving, setSaving] = useState(false);

  if (deposit.status !== "APPROVED") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const linkedAccount = accounts.find((a) => a.id === deposit.receivingPaymentAccountId) ?? null;
  const hasLinkedAccount = !!deposit.receivingPaymentAccountId;
  const logoUrl = linkedAccount
    ? (types.find((ty) => ty.value === linkedAccount.type)?.logoUrl ?? null)
    : null;
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
  const canSave = !!selectedAccountId && selectedAccountId !== deposit.receivingPaymentAccountId;

  const startEdit = () => {
    setSelectedAccountId(deposit.receivingPaymentAccountId);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const updated = await depositService.updateReceivingAccount(deposit.id, {
        // PATCH semantics server-side: omitted fields stay untouched, so this
        // cell sends only the catalog link it manages — the customer-FROM
        // record fields (UserDepositAccountCell's) are never in the payload
        // and can't be clobbered from here.
        paymentAccountId: selectedAccountId,
      });
      onSaved(updated);
      toast.success(t.deposits.receivingAccountCell.savedToast);
      setEditing(false);
    } catch (err) {
      toast.error(t.deposits.receivingAccountCell.saveFailedToast, {
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

  if (!hasLinkedAccount && !editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-warning/25 bg-warning/15 px-2 py-1 text-[11px] font-medium text-warning transition-colors hover:bg-warning/20"
      >
        <AlertCircle className="size-3 shrink-0" />
        {t.deposits.receivingAccountCell.notAdded}
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
            {t.deposits.receivingAccountCell.heading}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t.deposits.receivingAccountCell.subtext}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-normal text-muted-foreground">
            {t.deposits.receivingAccountCell.accountLabel}
          </Label>
          <Select
            items={accountItems}
            value={selectedAccountId ?? ""}
            onValueChange={(v) => v && setSelectedAccountId(v as string)}
          >
            <SelectTrigger size="sm" className="w-full" disabled={saving}>
              <SelectValue placeholder={t.deposits.receivingAccountCell.accountPlaceholder} />
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
            title={linkedAccount?.type ?? undefined}
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={linkedAccount?.type ?? ""} width={20} height={20} className="size-full object-cover" unoptimized />
            ) : (
              <ImageIcon className="size-2.5 text-muted-foreground" />
            )}
          </div>
          {/* Just the short internal label ("K1") — the full type/name/number
              detail lives in the tooltip and the edit dropdown. */}
          <span
            className="font-medium"
            title={linkedAccount ? `${accountLabel(linkedAccount, types)} · ${linkedAccount.accountNumber}` : undefined}
          >
            {linkedAccount
              ? linkedAccount.subname || linkedAccount.accountName
              : t.deposits.receivingAccountCell.missingAccount}
          </span>
          {linkedAccount && !linkedAccount.isActive && (
            <HiddenBadge label={t.deposits.receivingAccountCell.hidden} />
          )}
        </div>
      </div>
      <Button size="icon-sm" variant="ghost" onClick={startEdit} aria-label={t.deposits.receivingAccountCell.editAriaLabel}>
        <Pencil className="size-3" />
      </Button>
    </div>
  );
}
