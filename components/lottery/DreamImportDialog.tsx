"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dreamErrorMessage } from "@/components/lottery/dreamFormat";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryDreamImportResult } from "@/types/lottery";

interface DreamImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Downloads the current book's .xlsx, which doubles as the template. */
  onExport: () => void;
  exporting: boolean;
  /** Called after an applied import — the page reloads its list. */
  onApplied: () => void;
}

const ACCEPT = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

/** The most error rows listed in the dialog; the count above it is always complete. */
const ERRORS_SHOWN = 50;

/**
 * Import names from a spreadsheet in two steps: picking a file runs a dry
 * run (nothing changes) and shows what the real run would do; Apply then
 * runs it for real. The parent mounts it with a `key` per opening so each
 * import starts clean.
 */
export function DreamImportDialog({ open, onOpenChange, onExport, exporting, onApplied }: DreamImportDialogProps) {
  const { t } = useLanguage();
  const i = t.lottery.dreams.import;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LotteryDreamImportResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = checking || applying;

  const pick = async (picked: File) => {
    setFile(picked);
    setPreview(null);
    setCheckError(null);
    setChecking(true);
    try {
      setPreview(await lotteryService.importDreams(picked, true));
    } catch (err) {
      setCheckError(dreamErrorMessage(err, t));
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setCheckError(null);
  };

  const apply = async () => {
    if (!file) return;
    setApplying(true);
    try {
      const result = await lotteryService.importDreams(file, false);
      toast.success(i.appliedToast, {
        description: i.appliedSummary(result.updated, result.unchanged, result.errors.length),
      });
      onApplied();
      onOpenChange(false);
    } catch (err) {
      toast.error(i.applyFailedToast, { description: dreamErrorMessage(err, t) });
    } finally {
      setApplying(false);
    }
  };

  const canApply = !!file && !!preview && preview.updated > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{i.title}</DialogTitle>
          <DialogDescription>{i.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-[var(--border-strong)] p-3 text-xs text-muted-foreground">
            <p>{i.columnsHint}</p>
            <p className="mt-1">{i.blankHint}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 h-auto px-0"
              disabled={exporting || busy}
              onClick={onExport}
            >
              {exporting && <Loader2 className="size-3.5 animate-spin" />}
              {i.templateLink}
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void pick(picked);
              e.target.value = "";
            }}
          />

          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              {checking ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <button
                  type="button"
                  onClick={clear}
                  disabled={busy}
                  aria-label={i.clearFile}
                  className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-secondary/20 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UploadCloud className="size-5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{i.chooseFile}</span>
            </button>
          )}

          {checking && <p className="text-sm text-muted-foreground">{i.checking}</p>}

          {checkError && (
            <Alert variant="destructive">
              <AlertTitle>{i.checkFailed}</AlertTitle>
              <AlertDescription>{checkError}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span>{i.summary(preview.updated, preview.unchanged, preview.errors.length)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.updated > 0 ? i.applyHint : i.nothingToApply}
              </p>
              {preview.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-destructive/25 bg-destructive/10">
                  <ul className="flex flex-col divide-y divide-destructive/15 text-xs">
                    {preview.errors.slice(0, ERRORS_SHOWN).map((error, index) => (
                      <li key={`${error.row}-${index}`} className="flex gap-3 px-3 py-1.5">
                        <span className="shrink-0 tabular-nums text-destructive">{i.rowLabel(error.row)}</span>
                        <span className="min-w-0 text-destructive/90">{error.message}</span>
                      </li>
                    ))}
                    {preview.errors.length > ERRORS_SHOWN && (
                      <li className="px-3 py-1.5 text-muted-foreground">
                        {i.moreErrors(preview.errors.length - ERRORS_SHOWN)}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button onClick={apply} disabled={!canApply}>
            {applying && <Loader2 className="size-4 animate-spin" />}
            {applying ? i.applying : i.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
