"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLanguage } from "@/lib/context/language-context";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, csvPct, downloadCsv } from "@/components/lottery/analytics/csv";
import { formatCount, formatShare } from "@/components/lottery/analytics/format";
import type { FrequencyCardProps } from "@/components/lottery/analytics/FrequencyCard";

interface RepeatFirstTimeCardProps extends FrequencyCardProps {
  /** "Draw 3" when one draw is selected, for the wording; null for all draws. */
  drawShort: string | null;
}

/**
 * Returning against first-time buyers as a two-segment bar and the two
 * counts with their share. With a window and/or a draw a buyer is
 * first-time when their earliest paid purchase ever falls inside the
 * selection; with neither (All time · All draws) the backend counts draws
 * played instead — returning = bought in two or more draws — and says so
 * in `definition`, so the wording follows.
 */
export function RepeatFirstTimeCard({ data, isLoading, error, onRetry, range, drawShort, rangeText }: RepeatFirstTimeCardProps) {
  const { t } = useLanguage();
  const r = t.lottery.analytics.reports.repeat;
  const byDraws = data?.definition === "draws-played";
  const total = data ? data.returning + data.firstTime : 0;
  const returningShare = total > 0 && data ? data.returning / total : 0;
  const firstShare = total > 0 && data ? data.firstTime / total : 0;
  const note =
    !data || total === 0
      ? r.noteEmpty
      : data.returning === 0
        ? byDraws
          ? r.noteAllNewDraws
          : r.noteAllNew
        : byDraws
          ? r.noteDraws(formatShare(returningShare, 0))
          : drawShort
            ? r.noteDraw(formatShare(returningShare, 0), drawShort)
            : r.note(formatShare(returningShare, 0));
  const description = byDraws ? r.subDraws(rangeText) : drawShort ? r.subDraw(drawShort, rangeText) : r.sub(rangeText);
  const returningText = byDraws ? r.returningTextDraws : drawShort ? r.returningTextDraw : r.returningText;
  const firstTimeText = byDraws ? r.firstTimeTextDraws : drawShort ? r.firstTimeTextDraw(drawShort) : r.firstTimeText;

  const exportCsv = () => {
    const file = csvFileName(r.csvStem, range);
    downloadCsv(
      file,
      ["group", "buyers", "share_pct"],
      [
        ["returning", data?.returning ?? 0, csvPct(returningShare)],
        ["first_time", data?.firstTime ?? 0, csvPct(firstShare)],
        ["total", total, ""],
      ],
    );
    return file;
  };

  return (
    <AnalyticsCard
      title={r.title}
      description={description}
      actions={<ExportButton onExport={exportCsv} disabled={!data} />}
      refreshing={isLoading && data !== null}
    >
      {error ? (
        <ErrorState description={t.lottery.analytics.states.cardError} onRetry={onRetry} />
      ) : !data ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (
        <>
          <div
            className="flex h-4 w-full overflow-hidden rounded-full bg-muted-foreground/10"
            role="img"
            aria-label={`${r.returning} ${formatCount(data.returning)} (${formatShare(returningShare, 0)}), ${r.firstTime} ${formatCount(data.firstTime)} (${formatShare(firstShare, 0)})`}
          >
            <span className="h-full bg-[var(--chart-1)]" style={{ width: `${returningShare * 100}%` }} />
            <span className="h-full bg-[color-mix(in_oklab,var(--chart-1)_45%,white)]" style={{ width: `${firstShare * 100}%` }} />
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-[2px] bg-[var(--chart-1)]" />
                {r.returning}
              </dt>
              <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">
                {formatCount(data.returning)}{" "}
                <span className="text-sm font-medium text-muted-foreground">{formatShare(returningShare, 0)}</span>
              </dd>
              <dd className="text-xs text-muted-foreground">{returningText}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-[2px] bg-[color-mix(in_oklab,var(--chart-1)_45%,white)]" />
                {r.firstTime}
              </dt>
              <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">
                {formatCount(data.firstTime)}{" "}
                <span className="text-sm font-medium text-muted-foreground">{formatShare(firstShare, 0)}</span>
              </dd>
              <dd className="text-xs text-muted-foreground">{firstTimeText}</dd>
            </div>
          </dl>
          <p className="text-sm">{note}</p>
        </>
      )}
    </AnalyticsCard>
  );
}
