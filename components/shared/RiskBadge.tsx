"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/lib/context/language-context";
import { RISK_TONE } from "@/lib/status-tones";
import type { BankRiskLevel, BankRiskReason } from "@/types/bank-verification";

/**
 * LOW / MEDIUM / HIGH pill with a `+N` reason count beside it; a dash when
 * nothing has been scored yet. The full reason labels ride on the `title`
 * attribute so a hover explains the number without opening the modal.
 */
export function RiskBadge({
  level,
  reasons,
  className,
}: {
  level: BankRiskLevel | null;
  reasons: BankRiskReason[];
  className?: string;
}) {
  const { t } = useLanguage();
  const reasonLabels = reasons.map((code) => t.verification.reasons[code]);
  const title = reasonLabels.length > 0 ? reasonLabels.join("\n") : undefined;

  if (level === null) {
    return (
      <span className="text-xs text-muted-foreground" title={title ?? t.verification.risk.none}>
        —
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`} title={title}>
      <StatusBadge label={t.verification.risk[level]} tone={RISK_TONE[level]} className="normal-case" />
      {reasons.length > 0 && (
        <span className="text-xs tabular-nums text-muted-foreground">+{reasons.length}</span>
      )}
    </span>
  );
}
