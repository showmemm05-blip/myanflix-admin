"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Images, Loader2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { dreamErrorMessage } from "@/components/lottery/dreamFormat";
import {
  DREAM_PICTURE_ACCEPT,
  planDreamPictures,
  runLimited,
  type DreamPictureMatch,
  type DreamPictureSkip,
} from "@/components/lottery/dreamPictures";
import { useLanguage } from "@/lib/context/language-context";
import { ApiError } from "@/services/api/apiClient";
import { lotteryService } from "@/services/api/lotteryService";
import { uploadService } from "@/services/api/uploadService";
import type { LotteryDreamBook } from "@/types/lottery";

interface DreamPicturesImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The book the pictures go into — the page's current tab. */
  book: LotteryDreamBook;
  /** Called once a run has finished (even with failures) — the page reloads its list. */
  onApplied: () => void;
}

/** How many files are in flight at once: upload + save, so three keeps the backend comfortable. */
const PARALLEL = 3;

/**
 * The least time between two file starts. Each file costs one hit on three
 * routes (the row search, the upload, the save) and the backend's site-wide
 * limiter allows 300 hits a minute per route per client; 250 ms keeps a run
 * at 240 files a minute, under that on every route, so a 1,100-file run
 * takes about five minutes instead of tripping the limiter a third of the
 * way in.
 */
const FILE_INTERVAL_MS = 250;

/**
 * How long one upload or one save may take before it counts as failed
 * (the client times no write by default). A dead connection then fails
 * the one file instead of leaving the dialog running for good.
 */
const STEP_TIMEOUT_MS = 60_000;

/** How many times one step waits out a "Too many requests" answer before the file is marked failed. */
const RATE_LIMIT_RETRIES = 3;

/** The wait when the backend's 429 sentence carries no number of seconds — its bucket's full minute. */
const RATE_LIMIT_FALLBACK_SECONDS = 60;

/** The most skipped / failed names listed; the counts above them are always complete. */
const NAMES_SHOWN = 50;

type ItemStatus = "pending" | "done" | "failed";

interface Item extends DreamPictureMatch {
  status: ItemStatus;
  /** Why the file failed, in the staff member's language. */
  error?: string;
  /** Where the file landed once its upload went through, so a retry saves it again without uploading twice. */
  url?: string;
}

type Phase = "pick" | "running" | "finished";

/**
 * Give many numbers their picture in one go: pick the files, each named by
 * its number, see what will be uploaded, Start. Every matching file is
 * uploaded (purpose "lottery") and saved to its row, a few at a time. The
 * dialog stays open while it runs (Cancel stops after the files in
 * flight); failures are listed at the end and can be retried. The parent
 * mounts it with a `key` per opening so each run starts clean.
 */
export function DreamPicturesImportDialog({ open, onOpenChange, book, onApplied }: DreamPicturesImportDialogProps) {
  const { t } = useLanguage();
  const d = t.lottery.dreams;
  const p = d.pictures;
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<DreamPictureSkip[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [stopping, setStopping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  /** number → row id, filled as rows are looked up; a retry does not look them up again. */
  const rowIds = useRef(new Map<string, string>());
  const running = phase === "running";

  const pick = (files: File[]) => {
    const plan = planDreamPictures(files, book);
    setItems(plan.matched.map((match) => ({ ...match, status: "pending" })));
    setSkipped(plan.skipped);
    setPhase("pick");
  };

  const setItem = (index: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  /**
   * One request, with a 429 treated as "wait, then the same step again"
   * rather than a failure: the backend answers "Too many requests. Try
   * again in N seconds." and blocks that route for its bucket's minute, so
   * the step sleeps that long and tries once more, up to RATE_LIMIT_RETRIES
   * times. A stop request while waiting gives up at once.
   */
  const withRateLimit = async <T,>(call: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await call();
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 429 || attempt >= RATE_LIMIT_RETRIES || stopRef.current) throw err;
        const seconds = Number(/(\d+) seconds/.exec(err.message)?.[1]) || RATE_LIMIT_FALLBACK_SECONDS;
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      }
    }
  };

  const findRowId = async (number: string): Promise<string | null> => {
    const cached = rowIds.current.get(number);
    if (cached) return cached;
    // The search matches the number as a prefix, so "02" in Dream 100 also
    // returns 020–029 in Dream 1000's shape; the exact match is picked out.
    const page = await withRateLimit(() => lotteryService.listDreams({ book, q: number, pageSize: 5 }));
    const row = page.items.find((dream) => dream.number === number);
    if (!row) return null;
    rowIds.current.set(number, row.id);
    return row.id;
  };

  const importOne = async (item: Item, index: number): Promise<"done" | "failed"> => {
    try {
      const id = await findRowId(item.number);
      if (!id) {
        setItem(index, { status: "failed", error: p.rowMissing });
        return "failed";
      }
      // A file whose upload went through on an earlier pass keeps its URL,
      // so the retry only repeats the save.
      const url =
        item.url ??
        (await withRateLimit(() => uploadService.uploadImage(item.file, "lottery", AbortSignal.timeout(STEP_TIMEOUT_MS)))).url;
      setItem(index, { url });
      await withRateLimit(() => lotteryService.updateDream(id, { pictureUrl: url }, { timeoutMs: STEP_TIMEOUT_MS }));
      setItem(index, { status: "done", error: undefined });
      return "done";
    } catch (err) {
      setItem(index, { status: "failed", error: dreamErrorMessage(err, t) });
      return "failed";
    }
  };

  /** Runs every item that is not done yet — the first run, a retry, or a continue after Cancel. */
  const run = async () => {
    const queue = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status !== "done");
    if (queue.length === 0) return;
    stopRef.current = false;
    setStopping(false);
    setPhase("running");
    setItems((prev) => prev.map((item) => (item.status === "failed" ? { ...item, status: "pending", error: undefined } : item)));
    // The run's own tally: state updates land asynchronously, so the toast
    // below cannot read the counts back from `items`.
    const tally = { done: items.length - queue.length, failed: 0 };
    await runLimited(
      queue.length,
      PARALLEL,
      async (i) => {
        tally[await importOne(queue[i].item, queue[i].index)] += 1;
      },
      () => stopRef.current,
      FILE_INTERVAL_MS,
    );
    const left = items.length - tally.done - tally.failed;
    setPhase("finished");
    setStopping(false);
    toast[tally.failed > 0 || left > 0 ? "warning" : "success"](left > 0 ? p.stoppedToast : p.doneToast, {
      description: p.doneSummary(tally.done, tally.failed, left),
    });
    onApplied();
  };

  // The counts for the progress line, read from the items themselves so a
  // retry and a stopped run show the truth without separate counters.
  const done = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const pending = items.length - done - failed;
  const failedItems = items.filter((item) => item.status === "failed");
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round(((done + failed) / total) * 100);

  const close = () => !running && onOpenChange(false);
  const stop = () => {
    stopRef.current = true;
    setStopping(true);
  };

  const canStart = phase === "pick" && items.length > 0;
  const canContinue = phase === "finished" && pending > 0;
  const canRetry = phase === "finished" && pending === 0 && failed > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>{p.description(d.books[book])}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-[var(--border-strong)] p-3 text-xs text-muted-foreground">
            <p>{p.namingHint}</p>
            <p className="mt-1">{p.replaceHint}</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={DREAM_PICTURE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) pick(picked);
              // Reset so picking the same files again still fires a change.
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={running}
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-secondary/20 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Images className="size-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {items.length > 0 || skipped.length > 0 ? p.chooseAgain : p.chooseFiles}
            </span>
          </button>

          {(items.length > 0 || skipped.length > 0) && phase === "pick" && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span>{p.planSummary(total + skipped.length, total, skipped.length)}</span>
              </p>
              <p className="text-xs text-muted-foreground">{total > 0 ? p.startHint : p.nothingToStart}</p>
              {skipped.length > 0 && (
                <NameList
                  rows={skipped.map((skip) => ({ name: skip.file.name, detail: p.skipReasons[skip.reason] }))}
                  more={p.moreNames}
                />
              )}
            </div>
          )}

          {phase !== "pick" && (
            <div className="flex flex-col gap-2">
              <Progress value={percent} className="h-1.5" aria-label={p.progressLabel} />
              <p className="text-sm tabular-nums">
                {running ? p.progress(done, total, failed) : p.doneSummary(done, failed, pending)}
              </p>
              {running && stopping && <p className="text-xs text-muted-foreground">{p.stopping}</p>}
              {phase === "finished" && failedItems.length > 0 && (
                <NameList
                  rows={failedItems.map((item) => ({ name: item.file.name, detail: item.error ?? "" }))}
                  more={p.moreNames}
                  tone="destructive"
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={stop} disabled={stopping}>
              {stopping && <Loader2 className="size-4 animate-spin" />}
              {stopping ? p.stopping : t.common.cancel}
            </Button>
          ) : (
            <Button variant="outline" onClick={close}>
              {phase === "finished" ? t.common.close : t.common.cancel}
            </Button>
          )}
          {canStart && <Button onClick={run}>{p.start}</Button>}
          {canContinue && <Button onClick={run}>{p.continueRun}</Button>}
          {canRetry && <Button onClick={run}>{p.retryFailed}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NameListProps {
  rows: { name: string; detail: string }[];
  more: (count: number) => string;
  tone?: "muted" | "destructive";
}

/** File names with a reason beside each: the skipped ones before a run, the failed ones after. */
function NameList({ rows, more, tone = "muted" }: NameListProps) {
  const destructive = tone === "destructive";
  return (
    <div
      className={
        destructive
          ? "max-h-48 overflow-y-auto rounded-lg border border-destructive/25 bg-destructive/10"
          : "max-h-48 overflow-y-auto rounded-lg border border-border bg-secondary/40"
      }
    >
      <ul className={destructive ? "flex flex-col divide-y divide-destructive/15 text-xs" : "flex flex-col divide-y divide-border text-xs"}>
        {rows.slice(0, NAMES_SHOWN).map((row, index) => (
          <li key={`${row.name}-${index}`} className="flex gap-3 px-3 py-1.5">
            <span className={destructive ? "min-w-0 truncate font-medium text-destructive" : "min-w-0 truncate font-medium"}>
              {row.name}
            </span>
            <span className={destructive ? "ml-auto shrink-0 text-destructive/90" : "ml-auto shrink-0 text-muted-foreground"}>
              {row.detail}
            </span>
          </li>
        ))}
        {rows.length > NAMES_SHOWN && (
          <li className="px-3 py-1.5 text-muted-foreground">{more(rows.length - NAMES_SHOWN)}</li>
        )}
      </ul>
    </div>
  );
}
