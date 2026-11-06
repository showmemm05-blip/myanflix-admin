"use client";

import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/components/shared/StatusBadge";
import { CLAIM_STATUS_ICONS, CLAIM_STATUS_TONES } from "@/components/lottery/claims/claimFormat";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { LotteryWinnerClaimStatus } from "@/types/lottery";

/** StatusBadge's tones, with an icon in place of the dot. */
const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  danger: "bg-destructive/15 text-destructive border-destructive/25",
  info: "bg-info/15 text-info border-info/25",
  neutral: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/25",
};

/**
 * Where a prize's payment stands — Not requested · Waiting · Paid · Rejected
 * · Expired — as the board's chip: an icon and the word, never colour alone.
 * Used on the Prize claims page and in the winners table's Claim column.
 */
export function ClaimStatusBadge({ status, className }: { status: LotteryWinnerClaimStatus; className?: string }) {
  const { t } = useLanguage();
  const Icon = CLAIM_STATUS_ICONS[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-[22px] gap-1 px-2 text-[11px] font-semibold tracking-wide",
        TONE_STYLES[CLAIM_STATUS_TONES[status]],
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {t.lottery.claims.statuses[status]}
    </Badge>
  );
}
