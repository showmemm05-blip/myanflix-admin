"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/lib/context/language-context";
import { BANK_MATCH_TONE } from "@/lib/status-tones";
import type { BankMatchStatusView } from "@/types/bank-verification";

/**
 * The bank side of a row in one pill. Takes the VIEW status (the derived
 * NO_BANK_TRANSACTION included) — callers derive it through
 * `viewMatchStatus()` so every surface agrees on when a row flips.
 */
export function BankMatchBadge({ status, className }: { status: BankMatchStatusView; className?: string }) {
  const { t } = useLanguage();
  return (
    <StatusBadge
      label={t.verification.status[status]}
      tone={BANK_MATCH_TONE[status]}
      // Labels are already sentence-cased in both languages; the base
      // StatusBadge capitalises raw enum strings, which would mangle Burmese.
      className={className ? `normal-case ${className}` : "normal-case"}
    />
  );
}
