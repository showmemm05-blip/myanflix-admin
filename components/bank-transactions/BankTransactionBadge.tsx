"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/lib/context/language-context";
import { BANK_TRANSACTION_TONE } from "@/lib/status-tones";
import type { BankTransactionView } from "@/types/bank-transaction";

/**
 * The state of a phone-captured bank transaction in one pill. Takes the VIEW
 * state (UNCLAIMED included) — callers derive it through `viewOf()` so every
 * surface agrees on when a row crosses the 48 h line.
 */
export function BankTransactionBadge({ view, className }: { view: BankTransactionView; className?: string }) {
  const { t } = useLanguage();
  return (
    <StatusBadge
      label={t.bankTransactions.view[view]}
      tone={BANK_TRANSACTION_TONE[view]}
      // Labels are already sentence-cased in both languages; the base
      // StatusBadge capitalises raw enum strings, which would mangle Burmese.
      className={className ? `normal-case ${className}` : "normal-case"}
    />
  );
}
