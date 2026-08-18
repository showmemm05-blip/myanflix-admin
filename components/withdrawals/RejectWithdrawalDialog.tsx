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
import { withdrawalService } from "@/services/api/withdrawalService";
import type { Withdrawal } from "@/types/withdrawal";
import { toast } from "sonner";

function RejectWithdrawalForm({
  withdrawal,
  onOpenChange,
  onRejected,
}: {
  withdrawal: Withdrawal;
  onOpenChange: (open: boolean) => void;
  onRejected: (withdrawal: Withdrawal) => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReject = async () => {
    if (!reason.trim()) {
      setError(t.withdrawals.rejectDialog.reasonRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await withdrawalService.reject(withdrawal.id, reason.trim());
      onRejected(updated);
      toast.success(t.withdrawals.rejectDialog.rejectedToast, {
        description: t.withdrawals.rejectDialog.rejectedDescription(withdrawal.userName),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.withdrawals.rejectDialog.rejectFailedFallback);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.withdrawals.rejectDialog.title}</DialogTitle>
        <DialogDescription>
          {t.withdrawals.rejectDialog.descriptionFor(
            withdrawal.userName,
            formatKyat(withdrawal.amount),
            withdrawal.accountName,
            withdrawal.accountType,
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="withdrawal-rejection-reason">{t.withdrawals.rejectDialog.reasonLabel}</Label>
        <Textarea
          id="withdrawal-rejection-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          placeholder={t.withdrawals.rejectDialog.reasonPlaceholder}
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
          {t.withdrawals.rejectDialog.reject}
        </Button>
      </DialogFooter>
    </>
  );
}

export function RejectWithdrawalDialog({
  withdrawal,
  open,
  onOpenChange,
  onRejected,
}: {
  withdrawal: Withdrawal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: (withdrawal: Withdrawal) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {withdrawal && (
          <RejectWithdrawalForm
            key={withdrawal.id}
            withdrawal={withdrawal}
            onOpenChange={onOpenChange}
            onRejected={onRejected}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
