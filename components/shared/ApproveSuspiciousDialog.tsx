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
import { useLanguage } from "@/lib/context/language-context";

/**
 * The "are you sure?" that sits in front of Approve when the fraud checks
 * flagged the row SUSPICIOUS. The money decision is still the admin's — this
 * only makes it deliberate, and captures WHY as a note. The approve routes
 * take no body, so the page records the note through the verification
 * review endpoint (`confirm_suspicious`, audited with the note) and then
 * approves — the field is only offered when the admin holds EDIT.
 *
 * Not the shared ConfirmDialog because that one has no slot for a field.
 */
export function ApproveSuspiciousDialog({
  kind,
  open,
  onOpenChange,
  loading,
  showNote,
  onConfirm,
}: {
  kind: "deposit" | "withdrawal";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  /** DEPOSITS.EDIT / WITHDRAWALS.EDIT — without it the note could not be recorded, so it is not asked for. */
  showNote: boolean;
  onConfirm: (note: string) => void;
}) {
  const { t } = useLanguage();
  const a = t.verification.actions;
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setNote("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "deposit" ? a.approveSuspiciousTitle : a.approveSuspiciousWithdrawalTitle}</DialogTitle>
          <DialogDescription>
            {kind === "deposit" ? a.approveSuspiciousDescription : a.approveSuspiciousWithdrawalDescription}
          </DialogDescription>
        </DialogHeader>

        {showNote && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="approve-suspicious-note">{a.noteLabel}</Label>
            <Textarea
              id="approve-suspicious-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={a.notePlaceholder}
              maxLength={300}
              rows={2}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(note)} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {a.approveAnyway}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
