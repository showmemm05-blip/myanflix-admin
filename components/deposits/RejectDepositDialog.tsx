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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatKyat } from "@/lib/currency";
import { useLanguage } from "@/lib/context/language-context";
import { depositService } from "@/services/api/depositService";
import type { Deposit } from "@/types/deposit";
import { toast } from "sonner";

function RejectDepositForm({
  deposit,
  onOpenChange,
  onRejected,
}: {
  deposit: Deposit;
  onOpenChange: (open: boolean) => void;
  onRejected: (deposit: Deposit) => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReject = async () => {
    if (!reason.trim()) {
      setError(t.deposits.rejectDialog.reasonRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await depositService.reject(deposit.id, reason.trim());
      onRejected(updated);
      toast.success(t.deposits.rejectDialog.rejectedToast, {
        description: t.deposits.rejectDialog.rejectedDescription(deposit.userName),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deposits.rejectDialog.rejectFailedFallback);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.deposits.rejectDialog.title}</DialogTitle>
        <DialogDescription>
          {t.deposits.rejectDialog.descriptionFor(
            deposit.userName,
            formatKyat(deposit.amount),
            deposit.paymentMethod,
            deposit.reference,
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rejection-reason">{t.deposits.rejectDialog.reasonLabel}</Label>
        <Textarea
          id="rejection-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          placeholder={t.deposits.rejectDialog.reasonPlaceholder}
          maxLength={500}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button variant="destructive" onClick={handleReject} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.deposits.rejectDialog.reject}
        </Button>
      </DialogFooter>
    </>
  );
}

export function RejectDepositDialog({
  deposit,
  open,
  onOpenChange,
  onRejected,
}: {
  deposit: Deposit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: (deposit: Deposit) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {deposit && (
          <RejectDepositForm key={deposit.id} deposit={deposit} onOpenChange={onOpenChange} onRejected={onRejected} />
        )}
      </DialogContent>
    </Dialog>
  );
}
