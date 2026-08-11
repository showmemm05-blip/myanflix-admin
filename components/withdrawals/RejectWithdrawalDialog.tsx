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
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReject = async () => {
    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await withdrawalService.reject(withdrawal.id, reason.trim());
      onRejected(updated);
      toast.success("Withdrawal rejected", { description: `${withdrawal.userName}'s withdrawal was rejected.` });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject withdrawal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reject withdrawal</DialogTitle>
        <DialogDescription>
          {withdrawal.userName} — {formatKyat(withdrawal.amount)} to {withdrawal.accountName} (
          {withdrawal.accountType})
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="withdrawal-rejection-reason">Reason</Label>
        <Textarea
          id="withdrawal-rejection-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Account details could not be verified"
          maxLength={500}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleReject} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Reject withdrawal
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
