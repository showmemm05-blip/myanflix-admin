"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import {
  FEEDBACK_STATUS_TONE,
  FeedbackCategoryChip,
} from "@/components/tracking/feedbackColumns";
import { useLanguage } from "@/lib/context/language-context";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import { trackingService } from "@/services/api/trackingService";
import {
  FEEDBACK_STATUSES,
  type FeedbackStatus,
  type TrackedFeedback,
} from "@/types/tracking";

/** Mirrors `UpdateFeedbackStatusDto`'s `@MaxLength` so the textarea can't overrun the API. */
const ADMIN_NOTE_MAX = 2000;

/**
 * One feedback message in full, and the only place it can be triaged from.
 *
 * The status control and the internal note live together because they are one
 * decision: moving a row to RESOLVED without saying what was done leaves the
 * next person with a closed ticket and no story. `handledBy`/`handledAt` are
 * stamped by the server from the authenticated caller and are never sent.
 */
export function FeedbackDetailsDialog({
  feedback,
  open,
  onOpenChange,
  canManage,
  onSaved,
}: {
  feedback: TrackedFeedback | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** TRACKING.FEEDBACK_MANAGE — without it this is a read-only panel. */
  canManage: boolean;
  onSaved: (updated: TrackedFeedback) => void;
}) {
  const { t } = useLanguage();
  const f = t.tracking.feedback;

  /**
   * The edit buffer, tagged with the row it belongs to. Deriving the active
   * values during render (rather than syncing them in an effect) means
   * opening a different row can never show the previous row's unsaved draft,
   * and there is no effect to fire in the wrong order.
   */
  const [draft, setDraft] = useState<{
    id: string;
    status: FeedbackStatus;
    note: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const current =
    feedback && draft?.id === feedback.id
      ? draft
      : feedback
        ? { id: feedback.id, status: feedback.status, note: feedback.adminNote ?? "" }
        : null;

  const isDirty =
    !!feedback &&
    !!current &&
    (current.status !== feedback.status || current.note !== (feedback.adminNote ?? ""));

  const handleClose = (next: boolean) => {
    if (!next) setDraft(null);
    onOpenChange(next);
  };

  const handleSave = async () => {
    if (!feedback || !current) return;
    setSaving(true);
    try {
      // An empty note is sent as `""`, which the API reads as "clear it" —
      // "leave it alone" is `undefined`, and this dialog always has an
      // explicit value for the field.
      const updated = await trackingService.updateFeedbackStatus(feedback.id, {
        status: current.status,
        adminNote: current.note,
      });
      onSaved(updated);
      toast.success(f.toast.updated);
      setDraft(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(f.toast.failed, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        {feedback && current && (
          <>
            <DialogHeader>
              <DialogTitle>{f.details.title}</DialogTitle>
              <DialogDescription>
                {format(new Date(feedback.createdAt), "d MMM yyyy, HH:mm:ss")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <FeedbackCategoryChip category={feedback.category} t={t} />
                <PlatformChip platform={feedback.platform} />
                <StatusBadge
                  label={f.status[feedback.status]}
                  tone={FEEDBACK_STATUS_TONE[feedback.status]}
                />
              </div>

              <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.details.message}
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {feedback.message}
                </p>
              </section>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {f.details.submittedBy}
                  </dt>
                  <dd className="min-w-0 text-sm font-medium leading-snug">
                    <span className="block truncate">{userLabel(feedback.user)}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      @{feedback.user.username}
                    </span>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {t.tracking.common.phone}
                  </dt>
                  <dd className="min-w-0 font-mono text-sm font-medium leading-snug">
                    {formatLocalPhone(feedback.user.phone) ?? (
                      <span className="font-sans text-muted-foreground">
                        {t.tracking.common.noPhone}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {f.details.submittedOn}
                  </dt>
                  <dd className="text-sm font-medium leading-snug">
                    {format(new Date(feedback.createdAt), "d MMM yyyy, HH:mm")}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {f.details.handledBy}
                  </dt>
                  <dd className="min-w-0 text-sm font-medium leading-snug">
                    {feedback.handledBy ? (
                      <>
                        <span className="block truncate">{userLabel(feedback.handledBy)}</span>
                        {feedback.handledAt && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {f.details.handledOn}{" "}
                            {format(new Date(feedback.handledAt), "d MMM yyyy, HH:mm")}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        {f.details.notHandledYet}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {canManage ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="feedback-status">{f.details.statusLabel}</Label>
                    <Select
                      items={Object.fromEntries(
                        FEEDBACK_STATUSES.map((status) => [status, f.status[status]]),
                      )}
                      value={current.status}
                      onValueChange={(value) =>
                        setDraft({ ...current, status: value as FeedbackStatus })
                      }
                    >
                      <SelectTrigger id="feedback-status" className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEEDBACK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {f.status[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="feedback-note">{f.details.adminNote}</Label>
                    <Textarea
                      id="feedback-note"
                      value={current.note}
                      maxLength={ADMIN_NOTE_MAX}
                      placeholder={f.details.adminNotePlaceholder}
                      onChange={(e) => setDraft({ ...current, note: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">{f.details.adminNoteHint}</p>
                  </div>
                </div>
              ) : (
                <>
                  {feedback.adminNote && (
                    <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {f.details.adminNote}
                      </h3>
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {feedback.adminNote}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{f.details.needsPermission}</p>
                </>
              )}
            </div>

            {canManage && (
              <DialogFooter>
                <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
                  {t.common.close}
                </Button>
                <Button onClick={handleSave} disabled={saving || !isDirty}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? f.details.saving : f.details.save}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
