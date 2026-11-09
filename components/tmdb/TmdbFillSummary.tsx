"use client";

import { CircleCheck } from "lucide-react";
import { removedFields } from "@/components/tmdb/tmdbReview";
import { tmdbFieldLabel } from "@/components/tmdb/tmdbWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { TmdbField, TmdbFillReport } from "@/types/tmdb";

interface TmdbFillSummaryProps {
  /** What the server really did — the answer of an Apply, or of a series created from TMDB. */
  report: TmdbFillReport;
  /**
   * The fields the Apply named. A detail the report lists as "no value"
   * without having been named was taken back (it was the previous match's),
   * and the summary says "removed" rather than "skipped". Left out, every
   * such row reads as skipped.
   */
  sent?: readonly TmdbField[];
  className?: string;
}

/**
 * The short summary after a fill (2026-11-06, PLAN §6.4 "done"): which
 * details were filled in, how many actors were reused and created, which
 * categories were added, which details of the previous match were taken
 * back — and anything that was skipped, each with its reason, so a missing
 * poster or a left-out actor is never a surprise later.
 */
export function TmdbFillSummary({ report, sent, className }: TmdbFillSummaryProps) {
  const { t } = useLanguage();
  const d = t.tmdb.done;
  const name = (field: TmdbFillReport["filled"][number]) => tmdbFieldLabel(t, field);

  const removed = sent ? removedFields(report, sent) : [];
  const skipped: string[] = [
    ...report.skipped
      .filter(({ field, reason }) => !(reason === "no_value" && removed.includes(field)))
      .map(({ field, reason }) =>
        reason === "hand"
          ? d.skippedHand(name(field))
          : reason === "image_failed"
            ? d.skippedImageFailed(name(field))
            : d.skippedNoValue(name(field)),
      ),
    ...report.actors.skipped.map((actor) =>
      actor.reason === "same_name" ? d.actorSameName(actor.name) : d.actorNoPermission(actor.name),
    ),
  ];
  const actorsTouched = report.actors.reused + report.actors.created > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success/10 p-3">
        <CircleCheck className="size-4 shrink-0 translate-y-0.5 text-success" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
          {(report.filled.length > 0 || removed.length === 0) && (
            <p>{report.filled.length > 0 ? d.filled(report.filled.map(name).join(", ")) : d.nothingFilled}</p>
          )}
          {removed.length > 0 && <p>{d.removed(removed.map(name).join(", "))}</p>}
          {actorsTouched && <p>{d.actors(report.actors.reused, report.actors.created)}</p>}
          {report.categories.added.length > 0 && <p>{d.categoriesAdded(report.categories.added.join(", "))}</p>}
        </div>
      </div>

      {(skipped.length > 0 || report.categories.unmatched.length > 0) && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/20 p-3">
          <p className="font-medium">{d.skippedTitle}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
            {skipped.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {report.categories.unmatched.length > 0 && (
              <li>{d.categoriesUnmatched(report.categories.unmatched.join(", "))}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
