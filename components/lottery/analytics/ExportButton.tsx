"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryErrorMessage } from "@/components/lottery/drawFormat";

interface ExportButtonProps {
  /**
   * Builds and downloads the file; resolves to the file name for the
   * success toast. An export that still has to fetch (the 1000-row
   * numbers list) is async; one built from data in hand returns at once.
   */
  onExport: () => Promise<string> | string;
  disabled?: boolean;
  size?: "sm" | "xs";
  /**
   * The file carries a lottery-number column written as text formulas
   * (lib/csv.ts csvText) so spreadsheets keep the leading zeros; the success
   * toast says so.
   */
  numbersAsText?: boolean;
  /** Another page's own words for the button and its success toast (Ad results); the lottery's otherwise. */
  label?: string;
  exportedToast?: (file: string) => string;
}

/** The "Export CSV" button every analytics card carries, with its busy state and the toasts. */
export function ExportButton({
  onExport,
  disabled = false,
  size = "sm",
  numbersAsText = false,
  label,
  exportedToast,
}: ExportButtonProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const file = await onExport();
      toast.success(
        exportedToast ? exportedToast(file) : numbersAsText ? a.exportedNumbersToast(file) : a.exportedToast(file),
      );
    } catch (err) {
      toast.error(a.exportFailedToast, { description: lotteryErrorMessage(err, t) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size={size} disabled={disabled || busy} onClick={run}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {busy ? a.exporting : (label ?? a.exportCsv)}
    </Button>
  );
}
