"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BankScreenshot } from "@/components/shared/BankScreenshot";
import { useLanguage } from "@/lib/context/language-context";
import { bankTransactionService } from "@/services/api/bankTransactionService";

/**
 * The notification screenshot for one transaction, on its own. Reuses
 * BankScreenshot (token-fetched Blob, object URL, revoked on close) with the
 * transactions streaming route — the caller has already checked
 * BANK_TRANSACTIONS.BANK_EVIDENCE, the server checks it again.
 */
export function BankTransactionScreenshotDialog({
  transactionId,
  open,
  onOpenChange,
}: {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.bankTransactions.columns.screenshot}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{transactionId ?? ""}</DialogDescription>
        </DialogHeader>
        {transactionId && (
          <BankScreenshot rowId={transactionId} load={() => bankTransactionService.fetchScreenshot(transactionId)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
