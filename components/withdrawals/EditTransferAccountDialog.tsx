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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { withdrawalService } from "@/services/api/withdrawalService";
import type { Withdrawal } from "@/types/withdrawal";
import type { PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

function EditTransferAccountForm({
  withdrawal,
  types,
  onOpenChange,
  onSaved,
}: {
  withdrawal: Withdrawal;
  types: PaymentAccountType[];
  onOpenChange: (open: boolean) => void;
  onSaved: (withdrawal: Withdrawal) => void;
}) {
  const [transferAccountType, setTransferAccountType] = useState(
    withdrawal.transferAccountType ?? types[0]?.value ?? "",
  );
  const [transferAccountName, setTransferAccountName] = useState(withdrawal.transferAccountName ?? "");
  const [transferAccountNumber, setTransferAccountNumber] = useState(withdrawal.transferAccountNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const typeItems = Object.fromEntries(types.map((t) => [t.value, t.label]));
  const canSave =
    transferAccountType.trim().length > 0 &&
    transferAccountName.trim().length > 0 &&
    transferAccountNumber.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await withdrawalService.updateTransferAccount(withdrawal.id, {
        transferAccountType: transferAccountType.trim(),
        transferAccountName: transferAccountName.trim(),
        transferAccountNumber: transferAccountNumber.trim(),
      });
      onSaved(updated);
      toast.success("Transfer account recorded", {
        description: `Saved which of our accounts sent ${withdrawal.userName}'s withdrawal.`,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update transfer account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Our transfer account</DialogTitle>
        <DialogDescription>
          Record which of our accounts sent this payout. This is separate from the user&apos;s own withdrawal
          account below and does not affect approval status or wallet balance.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-border/50 bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            User&apos;s withdrawal account (read-only)
          </p>
          <div className="flex flex-col gap-0.5 text-sm">
            <span>
              {withdrawal.accountType} — {withdrawal.accountName}
            </span>
            <span className="text-muted-foreground">{withdrawal.accountNumber}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Our account type</Label>
          <Select
            items={typeItems}
            value={transferAccountType}
            onValueChange={(v) => v && setTransferAccountType(v as string)}
          >
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
          <Label htmlFor="transfer-account-name">Our account name</Label>
          <Input
            id="transfer-account-name"
            value={transferAccountName}
            onChange={(e) => {
              setTransferAccountName(e.target.value);
              setError(null);
            }}
            placeholder="MyanFlix"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transfer-account-number">Our phone number / account number</Label>
          <Input
            id="transfer-account-number"
            value={transferAccountNumber}
            onChange={(e) => {
              setTransferAccountNumber(e.target.value);
              setError(null);
            }}
            placeholder="09xxxxxxxxx"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditTransferAccountDialog({
  withdrawal,
  types,
  open,
  onOpenChange,
  onSaved,
}: {
  withdrawal: Withdrawal | null;
  types: PaymentAccountType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (withdrawal: Withdrawal) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {withdrawal && (
          <EditTransferAccountForm
            key={withdrawal.id}
            withdrawal={withdrawal}
            types={types}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
