"use client";

import { useEffect, useState } from "react";
import { Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/context/language-context";

/**
 * Renders the matched bank notification's screenshot. The PNG is streamed by
 * the API behind BANK_EVIDENCE (it shows the business account balance), so
 * it can never be a plain `<img src>` to a public URL: we fetch the Blob with
 * the admin's token, hand it to an object URL, and revoke that URL when the
 * component unmounts or the row changes — the same idiom as
 * `use-object-url.ts`, just for a fetched Blob instead of a picked File.
 *
 * `load` is the service call for this row (deposit or withdrawal); keying on
 * `rowId` restarts the fetch when the modal moves to another row.
 */
export function BankScreenshot({ rowId, load }: { rowId: string; load: () => Promise<Blob> }) {
  const { t } = useLanguage();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullSize, setFullSize] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    // Resetting before an async fetch is the documented data-fetching effect
    // pattern (see use-async-data.ts) — not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setError(null);

    load()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.verification.modal.screenshotLoadError);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `load` is a fresh closure each render; the row id is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId]);

  if (error) {
    return (
      <p className="text-xs text-destructive" title={error}>
        {t.verification.modal.screenshotLoadError}
      </p>
    );
  }

  if (!url) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {t.verification.modal.screenshotLoading}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {/* A blob: URL is not something next/image can optimise; a plain img
          is the right element for a one-off evidence render. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={t.verification.modal.screenshotSection}
        className="max-h-72 w-auto max-w-full cursor-zoom-in rounded-md border border-border"
        onClick={() => setFullSize(true)}
      />
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setFullSize(true)}>
        <Maximize2 className="size-3.5" />
        {t.verification.modal.openFullSize}
      </Button>

      <Dialog open={fullSize} onOpenChange={setFullSize}>
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-4xl">
          <DialogTitle className="sr-only">{t.verification.modal.screenshotSection}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={t.verification.modal.screenshotSection} className="h-auto w-full rounded-md" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
