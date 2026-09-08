"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { CornerDownRight, Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { CommentStatus, TrackedComment } from "@/types/tracking";

/**
 * Hidden is not a failure — it is the normal resting state of a moderated
 * comment — so it gets the neutral tone rather than a red one. Red is for
 * things that went wrong, and a moderator's own decision did not.
 */
export const COMMENT_STATUS_TONE: Record<CommentStatus, StatusTone> = {
  VISIBLE: "success",
  HIDDEN: "neutral",
};

export function getCommentColumns({
  t,
  /** TRACKING.COMMENTS_MODERATE. Without it the actions column is not built at all. */
  canModerate,
  onViewDetails,
  onToggleStatus,
  onDelete,
  pendingId,
}: {
  t: TranslationShape;
  canModerate: boolean;
  onViewDetails: (comment: TrackedComment) => void;
  onToggleStatus: (comment: TrackedComment) => void;
  onDelete: (comment: TrackedComment) => void;
  /** The row currently being written to — its buttons are disabled while in flight. */
  pendingId?: string | null;
}): ColumnDef<TrackedComment>[] {
  const c = t.tracking.comments;

  const columns: ColumnDef<TrackedComment>[] = [
    {
      id: "user",
      header: c.columns.user,
      cell: ({ row }) => (
        <div className="flex max-w-40 flex-col">
          {/* The chosen name on top, the login identity muted underneath — a
              display name must never hide which account posted this. */}
          <span className="truncate text-sm font-medium">{userLabel(row.original.user)}</span>
          <span className="truncate text-xs text-muted-foreground">
            @{row.original.user.username}
          </span>
        </div>
      ),
    },
    {
      id: "phone",
      header: c.columns.phone,
      cell: ({ row }) => {
        const phone = formatLocalPhone(row.original.user.phone);
        // A masked number is still a number and is rendered as one. Only a
        // genuinely absent one gets the muted "no phone on file" wording.
        return phone ? (
          <span className="font-mono text-xs">{phone}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.tracking.common.noPhone}</span>
        );
      },
    },
    {
      id: "comment",
      header: c.columns.comment,
      cell: ({ row }) => {
        const comment = row.original;
        return (
          <div className="flex max-w-xs flex-col items-start gap-1">
            {comment.parentId && (
              <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                <CornerDownRight aria-hidden="true" />
                {c.replyBadge}
              </Badge>
            )}
            {/* The whole snippet is the affordance: two lines to triage on,
                one click to read the rest before deciding anything. */}
            <button
              type="button"
              onClick={() => onViewDetails(comment)}
              className="text-left text-sm leading-snug transition-colors hover:text-primary"
              title={t.tracking.common.viewDetails}
            >
              <span className="line-clamp-2 break-words">{comment.body}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground underline underline-offset-2">
                {c.readMore}
              </span>
            </button>
          </div>
        );
      },
    },
    {
      id: "title",
      header: c.columns.title,
      cell: ({ row }) => {
        const title = row.original.title;
        if (!title) {
          return (
            <span className="text-xs text-muted-foreground">{c.titleUnavailable}</span>
          );
        }
        return (
          <div className="flex max-w-40 flex-col">
            <span className="truncate text-sm font-medium">{title.name}</span>
            <span className="text-xs text-muted-foreground">{c.titleKind[title.kind]}</span>
          </div>
        );
      },
    },
    {
      id: "platform",
      header: c.columns.platform,
      cell: ({ row }) => <PlatformChip platform={row.original.platform} />,
    },
    {
      accessorKey: "status",
      header: c.columns.status,
      cell: ({ row }) => (
        <StatusBadge
          label={c.status[row.original.status]}
          tone={COMMENT_STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      accessorKey: "createdAt",
      header: c.columns.date,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm")}
        </span>
      ),
    },
  ];

  // Built only for a moderator. A reader gets no disabled stub to poke at —
  // the page states once, above the table, that moderation needs a permission.
  if (canModerate) {
    columns.push({
      id: "actions",
      header: t.tracking.common.actions,
      cell: ({ row }) => {
        const comment = row.original;
        const isHidden = comment.status === "HIDDEN";
        // The old "…" trigger was disabled for the whole row while a write
        // was in flight; every button inherits that same rule.
        const pending = pendingId === comment.id;
        return (
          <RowActions>
            <RowActionButton
              icon={Eye}
              label={t.tracking.common.viewDetails}
              disabled={pending}
              onClick={() => onViewDetails(comment)}
            />
            <RowActionButton
              icon={isHidden ? Eye : EyeOff}
              label={isHidden ? c.actions.restore : c.actions.hide}
              disabled={pending}
              onClick={() => onToggleStatus(comment)}
            />
            <RowActionButton
              icon={Trash2}
              label={c.actions.delete}
              destructive
              disabled={pending}
              onClick={() => onDelete(comment)}
            />
          </RowActions>
        );
      },
    });
  }

  return columns;
}
