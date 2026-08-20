"use client";

import { format } from "date-fns";
import { CornerDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { COMMENT_STATUS_TONE } from "@/components/tracking/commentColumns";
import { useLanguage } from "@/lib/context/language-context";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import type { TrackedComment } from "@/types/tracking";

/**
 * The full text of one comment, plus who wrote it and where from.
 *
 * The table truncates a comment to two lines — enough to triage, not enough
 * to moderate on. This is where the whole thing is readable, so a decision to
 * hide or delete is never made from an ellipsis.
 */
export function CommentDetailsDialog({
  comment,
  open,
  onOpenChange,
}: {
  comment: TrackedComment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const c = t.tracking.comments;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {comment && (
          <>
            <DialogHeader>
              <DialogTitle>{c.details.title}</DialogTitle>
              <DialogDescription>
                {comment.title?.name ?? c.titleUnavailable}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformChip platform={comment.platform} />
                <StatusBadge
                  label={c.status[comment.status]}
                  tone={COMMENT_STATUS_TONE[comment.status]}
                />
                {comment.parentId && (
                  <Badge variant="outline" className="gap-1 font-medium">
                    <CornerDownRight aria-hidden="true" />
                    {c.replyBadge}
                  </Badge>
                )}
              </div>

              <section className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {c.details.commentBody}
                </h3>
                {/* Whitespace preserved: line breaks are part of what was
                    actually posted, and a moderator is judging exactly that. */}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {comment.body}
                </p>
              </section>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {c.details.postedBy}
                  </dt>
                  <dd className="min-w-0 text-sm font-medium leading-snug">
                    <span className="block truncate">{userLabel(comment.user)}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      @{comment.user.username}
                    </span>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {t.tracking.common.phone}
                  </dt>
                  <dd className="min-w-0 font-mono text-sm leading-snug font-medium">
                    {formatLocalPhone(comment.user.phone) ?? (
                      <span className="font-sans text-muted-foreground">
                        {t.tracking.common.noPhone}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {c.details.postedOn}
                  </dt>
                  <dd className="text-sm font-medium leading-snug">
                    {format(new Date(comment.createdAt), "d MMM yyyy, HH:mm:ss")}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">
                    {t.tracking.common.ipAddress}
                  </dt>
                  <dd className="min-w-0 break-all font-mono text-sm leading-snug font-medium">
                    {comment.ipAddress ?? (
                      <span className="font-sans text-muted-foreground">
                        {t.tracking.common.noIp}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {comment.parentId && (
                <p className="text-xs text-muted-foreground">{c.details.inReplyTo}</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
