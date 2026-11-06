"use client";

import { useEffect, useState } from "react";
import { DownloadCloud, Loader2, PencilLine, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EnterResultsDialog } from "@/components/lottery/EnterResultsDialog";
import { PublishDrawDialog } from "@/components/lottery/PublishDrawDialog";
import { DrawClaimsStrip } from "@/components/lottery/claims/DrawClaimsStrip";
import {
  formatRate,
  lotteryErrorMessage,
} from "@/components/lottery/drawFormat";
import {
  RESULT_STATUS_TONES,
  formatBaht,
  formatKs,
  isExchangeRate,
  normalizeResults,
  prizeGroupName,
  prizeKs,
  sheetGroups,
} from "@/components/lottery/resultsFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { formatMmt } from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_LIMITS,
  type LotteryAdminDraw,
  type LotteryDrawResults,
  type LotteryResultGroup,
  type LotterySettings,
} from "@/types/lottery";

/** The 4th and 5th prizes are long lists: this many show until "Show all". */
const COLLAPSED_COUNT = 10;

interface ResultsCardProps {
  draw: LotteryAdminDraw;
  /** For the rate's prefill and whether a results URL is set; null while loading or when refused. */
  settings: LotterySettings | null;
  /** LOTTERY.RESULTS_PUBLISH — fetch, enter by hand, publish. */
  canPublish: boolean;
  /** The draw changed on the server (published, or a 409 said it moved): the page reloads it. */
  onDrawChanged: () => void;
  /**
   * The record as this card has it (normalized; null until loaded), on every
   * load — the page's "Reopen sales" hides once a sheet is in, and a sheet
   * entered by hand changes nothing on the draw itself.
   */
  onResultsChanged?: (results: LotteryDrawResults | null) => void;
}

/**
 * The winning numbers of one draw (phase 3). The record is loaded apart
 * from the draw: Waiting until the cron (or "Fetch now") has fetched it or
 * the admin typed it in, then the nine groups laid out like the Results
 * board — the 1st prize big, the rest in cards — each with its Baht and the
 * kyat it pays at the rate on the card. The rate is prefilled from Settings,
 * editable until the draw is published, and sent with Publish; "Publish
 * results" shows the counted totals first, then marks every ticket and
 * works out every prize — since 2026-10-24 it pays NOBODY: the winners
 * request their payment in the app and each claim is confirmed on Prize
 * claims, and the published card shows how those claims stand (the strip).
 * Once published the sheet is locked and the card says when and at what
 * rate.
 */
export function ResultsCard({
  draw,
  settings,
  canPublish,
  onDrawChanged,
  onResultsChanged,
}: ResultsCardProps) {
  const { t } = useLanguage();
  const d = t.lottery.draws;
  const r = d.detail.results;
  const published = draw.status === "published";
  const closed = draw.status === "closed";

  // The backend makes the record on first read (pending, empty sheet), so
  // a draw that exists always has one — a failed read is a real failure.
  const {
    data: results,
    isLoading,
    error,
    refetch,
  } = useAsyncData<LotteryDrawResults>(
    async () => normalizeResults(await lotteryService.getDrawResults(draw.id)),
    [draw.id, draw.status, draw.publishedAt],
  );
  useEffect(() => {
    onResultsChanged?.(results);
  }, [results, onResultsChanged]);

  // The rate: the draw's own once published; before that what the admin
  // typed, else the setting's (the record's `rate` is the same value and
  // covers a refused settings read). The override starts unset so the
  // field shows the setting as soon as it loads.
  const [rateOverride, setRateOverride] = useState<string | null>(null);
  const defaultRate = settings?.exchangeRate ?? results?.rate ?? null;
  const rateText = published
    ? draw.exchangeRate !== null
      ? String(draw.exchangeRate)
      : ""
    : (rateOverride ?? (defaultRate !== null ? String(defaultRate) : ""));
  const rateValid = isExchangeRate(rateText);
  const rate = rateValid ? Number(rateText.trim()) : null;

  const [fetching, setFetching] = useState(false);
  const [enterOpen, setEnterOpen] = useState(false);
  const [enterKey, setEnterKey] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishKey, setPublishKey] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = sheetGroups(results?.groups ?? []);
  const hasNumbers = groups.some((g) => g.numbers.length > 0);
  // The backend's own check (every group full, every number the right length) — what Publish requires.
  const sheetComplete =
    !!results && results.status === "fetched" && results.complete;
  const sourceSet = !!settings?.resultsUrl;
  const canAct = canPublish && closed;

  const fetchNow = async () => {
    setFetching(true);
    try {
      const record = normalizeResults(
        await lotteryService.fetchDrawResults(draw.id),
      );
      // The backend answers 200 with the record either way: a fresh sheet
      // clears lastError; otherwise lastError says what happened, and a
      // sheet already in keeps its "fetched" status, so the status alone
      // cannot tell a success from a retry that changed nothing.
      if (!record.lastError) toast.success(r.fetchedToast);
      else if (record.status === "failed")
        toast.error(r.fetchFailedToast, { description: record.lastError });
      else
        toast.message(r.fetchNoMatchToast, { description: record.lastError });
      refetch();
    } catch (err) {
      toast.error(r.fetchFailedToast, {
        description: lotteryErrorMessage(err, t),
      });
    } finally {
      setFetching(false);
    }
  };

  const openEnter = () => {
    setEnterKey((k) => k + 1);
    setEnterOpen(true);
  };
  const openPublish = () => {
    setPublishKey((k) => k + 1);
    setPublishOpen(true);
  };

  /** The status line and its badge, from the draw and the record together. */
  const status = (() => {
    if (published) {
      // What publishing worked out, and that it paid nobody — only once the
      // backend sends the awarded total (an older one leaves it out).
      const awarded = draw.prizeTotalKs ?? null;
      return {
        tone: RESULT_STATUS_TONES.published,
        badge: d.statuses.published,
        line: r.status.published(formatMmt(draw.publishedAt)),
        hint:
          awarded !== null && draw.exchangeRate !== null
            ? r.status.publishedHint(draw.winnersCount ?? 0, formatKs(awarded), formatRate(draw.exchangeRate))
            : undefined,
      };
    }
    if (!results || results.status === "pending") {
      const waiting = !closed;
      return {
        tone: RESULT_STATUS_TONES.pending,
        badge: r.status.badges.waiting,
        line: waiting ? r.status.beforeDraw : r.status.pending,
        hint: waiting
          ? r.status.pendingHint(formatMmt(draw.drawAt))
          : undefined,
      };
    }
    if (results.status === "failed") {
      return {
        tone: RESULT_STATUS_TONES.failed,
        badge: r.status.badges.failed,
        line: r.status.failed,
      };
    }
    return {
      tone: RESULT_STATUS_TONES.fetched,
      badge:
        results.source === "manual"
          ? r.status.badges.manual
          : r.status.badges.fetched,
      line:
        results.source === "manual"
          ? r.status.fetchedManual(
              formatMmt(results.fetchedAt ?? results.updatedAt),
              results.enteredBy?.label ?? null,
            )
          : r.status.fetchedApi(
              formatMmt(results.fetchedAt ?? results.updatedAt),
            ),
    };
  })();

  const renderGroup = (group: LotteryResultGroup, big: boolean) => {
    const ks = rate !== null ? prizeKs(group.baht, rate) : null;
    const long = group.numbers.length > COLLAPSED_COUNT;
    const open = !!expanded[group.key];
    const shown =
      long && !open ? group.numbers.slice(0, COLLAPSED_COUNT) : group.numbers;
    return (
      <div
        key={group.key}
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-3",
          big && "items-center bg-primary/5 p-5 text-center",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-baseline gap-x-3 gap-y-0.5",
            big ? "justify-center" : "justify-between",
          )}
        >
          <span className={cn("font-semibold", big ? "text-base" : "text-sm")}>
            {prizeGroupName(group.key, t)}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {group.numbers.length === group.count
              ? group.count.toLocaleString("en-US")
              : r.countOf(group.numbers.length, group.count)}
          </span>
        </div>
        {group.numbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{r.noNumbers}</p>
        ) : big ? (
          <p className="font-mono text-4xl font-bold tracking-[0.2em] tabular-nums">
            {group.numbers.join("  ")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {shown.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="inline-flex h-7 items-center rounded-md border border-[var(--border-strong)] bg-background px-2 font-mono text-sm tabular-nums"
              >
                {n}
              </span>
            ))}
          </div>
        )}
        {long && (
          <Button
            size="xs"
            variant="ghost"
            className="self-start"
            onClick={() =>
              setExpanded((prev) => ({ ...prev, [group.key]: !open }))
            }
          >
            {open ? r.showFewer : r.showAll(group.numbers.length)}
          </Button>
        )}
        <p
          className={cn(
            "text-xs tabular-nums text-muted-foreground",
            big && "text-sm",
          )}
        >
          <span
            className={cn("font-medium text-foreground", big && "text-base")}
          >
            {r.bahtValue(formatBaht(group.baht))}
          </span>
          {ks !== null && <span> {r.ksValue(formatKs(ks))}</span>}
          <span> · {r.perTicket}</span>
        </p>
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {r.title}
          {!isLoading && !error && (
            <StatusBadge label={status.badge} tone={status.tone} />
          )}
        </CardTitle>
        <CardDescription>{r.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-64 rounded" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : error ? (
          <ErrorState description={r.loadError} onRetry={refetch} />
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{status.line}</p>
              {"hint" in status && status.hint && (
                <p className="text-xs text-muted-foreground">{status.hint}</p>
              )}
              {results?.sourceDate && results.status !== "pending" && (
                <p className="text-xs text-muted-foreground">
                  {r.status.sourceDate(results.sourceDate)}
                </p>
              )}
              {results &&
                results.status !== "published" &&
                results.lastError && (
                  <p className="text-xs text-destructive">
                    {results.lastError}
                    {results.attempts > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.status.attempts(results.attempts)}
                      </span>
                    )}
                  </p>
                )}
              {!published && closed && !sourceSet && (
                <p className="text-xs text-muted-foreground">{r.noSource}</p>
              )}
              {!published && !closed && canPublish && (
                <p className="text-xs text-muted-foreground">{r.notClosed}</p>
              )}
            </div>

            {hasNumbers && (
              <div className="flex flex-col gap-3">
                {renderGroup(groups[0], true)}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {groups.slice(1).map((g) => renderGroup(g, false))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="draw-rate">{r.rateLabel}</Label>
                <Input
                  id="draw-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateText}
                  // Typed only where it can be sent: a closed draw by a RESULTS_PUBLISH holder.
                  disabled={!canAct || fetching}
                  aria-invalid={canAct && !rateValid}
                  className="tabular-nums sm:max-w-xs"
                  onChange={(e) => setRateOverride(e.target.value)}
                />
                <p
                  className={
                    canAct && !rateValid
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {published
                    ? rate !== null
                      ? r.ratePaid(formatRate(rate))
                      : d.detail.exchangeRateUnset
                    : canAct && !rateValid
                      ? r.rateInvalid(LOTTERY_LIMITS.exchangeRateDecimals)
                      : r.rateHint}
                </p>
              </div>
            </div>

            {canAct && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {sourceSet && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fetching}
                      onClick={fetchNow}
                    >
                      {fetching ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <DownloadCloud className="size-4" />
                      )}
                      {fetching ? r.fetching : r.fetchNow}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={fetching}
                    onClick={openEnter}
                  >
                    <PencilLine className="size-4" />
                    {r.enterByHand}
                  </Button>
                  <Button
                    size="sm"
                    disabled={fetching || !sheetComplete || rate === null}
                    onClick={openPublish}
                  >
                    <Trophy className="size-4" />
                    {r.publish}
                  </Button>
                </div>
                {results && results.status === "fetched" && !sheetComplete && (
                  <p className="text-xs text-warning">{r.incompleteSheet}</p>
                )}
                {/* The one-line note under the buttons: publishing pays nobody; the winners request, the admin confirms. */}
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{r.publishNoteLead}</span> {r.publishNote}
                </p>
              </div>
            )}

            {/* Once published: how the draw's prize claims stand, and the way to the Prize claims page filtered to it. */}
            {published && <DrawClaimsStrip draw={draw} />}
          </>
        )}
      </CardContent>

      {canAct && enterOpen && (
        <EnterResultsDialog
          key={enterKey}
          open={enterOpen}
          onOpenChange={setEnterOpen}
          draw={draw}
          results={results}
          onSaved={() => refetch()}
        />
      )}

      {canAct && publishOpen && rate !== null && (
        <PublishDrawDialog
          key={publishKey}
          open={publishOpen}
          onOpenChange={setPublishOpen}
          draw={draw}
          rate={rate}
          onPublished={onDrawChanged}
          onConflict={onDrawChanged}
        />
      )}
    </Card>
  );
}
