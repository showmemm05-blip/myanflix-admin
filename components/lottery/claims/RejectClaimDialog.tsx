"use client";

import { useState } from "react";
import { CircleX, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { claimDrawLabel, formatMoney, isClaimStateError } from "@/components/lottery/claims/claimFormat";
import { lotteryErrorMessage } from "@/components/lottery/drawFormat";
import { useLanguage } from "@/lib/context/language-context";
import { userLabel } from "@/lib/user-label";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_CLAIM_NOTE_MAX,
  LOTTERY_CLAIM_REJECT_REASONS,
  type LotteryAdminClaim,
  type LotteryAdminClaimDetail,
  type LotteryClaimRejectReason,
} from "@/types/lottery";

interface RejectClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: LotteryAdminClaim;
  /** The claim's id (a waiting claim always has one). */
  claimId: string;
  onRejected: (detail: LotteryAdminClaimDetail) => void;
  /** The claim was not waiting any more (409): the parent reloads it. */
  onConflict: () => void;
}

/**
 * The board's Reject dialog: a preset reason (Suspicious account · Duplicate
 * request · Ticket under review · Other) and a note the customer reads word
 * for word — required for Other, optional otherwise, at most 300 characters.
 * Mounted with a `key` per opening, so the fields start fresh each time.
 */
export function RejectClaimDialog({ open, onOpenChange, claim, claimId, onRejected, onConflict }: RejectClaimDialogProps) {
  const { t } = useLanguage();
  const c = t.lottery.claims;
  const r = c.rejectDialog;
  const [reason, setReason] = useState<LotteryClaimRejectReason>("ticket_under_review");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);

  const trimmed = note.trim();
  const needNote = reason === "other";
  const missing = needNote && trimmed.length === 0;
  const tooLong = trimmed.length > LOTTERY_CLAIM_NOTE_MAX;
  const invalid = missing || tooLong;

  const name = userLabel(claim.user);
  const drawLabel = claimDrawLabel(t, claim);
  const ksText = formatMoney(claim.ks);
  const reasonLabels: Record<string, string> = Object.fromEntries(
    LOTTERY_CLAIM_REJECT_REASONS.map((key) => [key, c.reasons[key]]),
  );

  const handleSubmit = async () => {
    if (invalid) {
      setShowProblems(true);
      return;
    }
    setSaving(true);
    try {
      const detail = await lotteryService.rejectClaim(claimId, trimmed ? { reason, note: trimmed } : { reason });
      toast.warning(r.rejectedToast(c.reasons[reason]), {
        description: r.rejectedToastDescription(name, drawLabel, ksText),
      });
      onRejected(detail);
      onOpenChange(false);
    } catch (err) {
      toast.error(r.rejectFailedToast, { description: lotteryErrorMessage(err, t) });
      if (isClaimStateError(err)) {
        onConflict();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const noteProblem = showProblems || trimmed.length > 0 ? (missing ? r.noteMissing : tooLong ? r.noteTooLong(LOTTERY_CLAIM_NOTE_MAX) : null) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{r.title}</DialogTitle>
          <DialogDescription>{r.text(name, drawLabel, ksText)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="claim-reject-reason">{r.reason}</Label>
            <Select
              items={reasonLabels}
              value={reason}
              onValueChange={(next) => next && setReason(next as LotteryClaimRejectReason)}
            >
              <SelectTrigger id="claim-reject-reason" className="w-full" disabled={saving}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOTTERY_CLAIM_REJECT_REASONS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {c.reasons[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{r.reasonHelp[reason]}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="claim-reject-note">{needNote ? r.noteRequired : r.noteOptional}</Label>
            <Textarea
              id="claim-reject-note"
              value={note}
              rows={3}
              placeholder={r.notePlaceholder}
              disabled={saving}
              aria-invalid={!!noteProblem}
              aria-describedby="claim-reject-note-help"
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex items-baseline justify-between gap-3">
              <p id="claim-reject-note-help" className={noteProblem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {noteProblem ?? r.noteHelp}
              </p>
              <span className={tooLong ? "shrink-0 text-xs tabular-nums text-destructive" : "shrink-0 text-xs tabular-nums text-muted-foreground"}>
                {r.noteCount(trimmed.length, LOTTERY_CLAIM_NOTE_MAX)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={saving || (showProblems && invalid)}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CircleX className="size-4" />}
            {r.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
