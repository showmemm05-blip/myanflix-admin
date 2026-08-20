"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { FeedbackCategory, FeedbackStatus, TrackedFeedback } from "@/types/tracking";

/**
 * Triage order made visible: NEW is the only state that wants attention, so
 * it gets the one colour that reads as "look at me". IN_REVIEW is warm
 * because somebody owns it, RESOLVED green, DISMISSED deliberately grey —
 * a closed row should recede.
 */
export const FEEDBACK_STATUS_TONE: Record<FeedbackStatus, StatusTone> = {
  NEW: "info",
  IN_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

/**
 * Category is what the row is ABOUT, not how urgent it is — a bug and a
 * payment complaint are the two that cost money, so they carry the loud
 * tones; the rest stay quiet. Rendered as a plain outline chip (no status
 * dot) so it never reads as a second status column.
 */
const FEEDBACK_CATEGORY_STYLES: Record<FeedbackCategory, string> = {
  BUG: "bg-destructive/15 text-destructive border-destructive/25",
  SUGGESTION: "bg-info/15 text-info border-info/25",
  CONTENT: "bg-chart-4/15 text-chart-4 border-chart-4/25",
  PAYMENT: "bg-warning/15 text-warning border-warning/25",
  OTHER: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/25",
};

export function FeedbackCategoryChip({
  category,
  t,
}: {
  category: FeedbackCategory;
  t: TranslationShape;
}) {
  return (
    <Badge
      variant="outline"
      className={`font-medium ${FEEDBACK_CATEGORY_STYLES[category]}`}
    >
      {t.tracking.feedback.category[category]}
    </Badge>
  );
}

export function getFeedbackColumns({
  t,
  onViewDetails,
}: {
  t: TranslationShape;
  onViewDetails: (feedback: TrackedFeedback) => void;
}): ColumnDef<TrackedFeedback>[] {
  const f = t.tracking.feedback;

  return [
    {
      id: "user",
      header: f.columns.user,
      cell: ({ row }) => (
        <div className="flex max-w-40 flex-col">
          <span className="truncate text-sm font-medium">{userLabel(row.original.user)}</span>
          <span className="truncate text-xs text-muted-foreground">
            @{row.original.user.username}
          </span>
        </div>
      ),
    },
    {
      id: "phone",
      header: f.columns.phone,
      cell: ({ row }) => {
        const phone = formatLocalPhone(row.original.user.phone);
        return phone ? (
          <span className="font-mono text-xs">{phone}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.tracking.common.noPhone}</span>
        );
      },
    },
    {
      accessorKey: "category",
      header: f.columns.category,
      cell: ({ row }) => <FeedbackCategoryChip category={row.original.category} t={t} />,
    },
    {
      id: "message",
      header: f.columns.message,
      cell: ({ row }) => {
        const feedback = row.original;
        return (
          // Opening the row is the only way to act on it — the status control
          // and the internal note both live in the details dialog — so the
          // message snippet is the entry point rather than a dead preview.
          <button
            type="button"
            onClick={() => onViewDetails(feedback)}
            className="flex max-w-xs flex-col items-start text-left text-sm leading-snug transition-colors hover:text-primary"
            title={t.tracking.common.viewDetails}
          >
            <span className="line-clamp-2 break-words">{feedback.message}</span>
            <span className="mt-0.5 text-xs text-muted-foreground underline underline-offset-2">
              {t.tracking.common.viewDetails}
            </span>
          </button>
        );
      },
    },
    {
      id: "platform",
      header: f.columns.platform,
      cell: ({ row }) => <PlatformChip platform={row.original.platform} />,
    },
    {
      accessorKey: "status",
      header: f.columns.status,
      cell: ({ row }) => (
        <StatusBadge
          label={f.status[row.original.status]}
          tone={FEEDBACK_STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      id: "handledBy",
      header: f.columns.handledBy,
      cell: ({ row }) => {
        const handler = row.original.handledBy;
        if (!handler) {
          return (
            <span className="text-xs text-muted-foreground">{f.details.notHandledYet}</span>
          );
        }
        return (
          <div className="flex max-w-36 flex-col">
            <span className="truncate text-sm">{userLabel(handler)}</span>
            {row.original.handledAt && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {format(new Date(row.original.handledAt), "d MMM yyyy")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: f.columns.date,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm")}
        </span>
      ),
    },
  ];
}
