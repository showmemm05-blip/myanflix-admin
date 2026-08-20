"use client";

import { CircleHelp, Globe, Smartphone, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { ClientPlatform } from "@/types/tracking";

/**
 * Same tone-pair idiom as RoleBadge/StatusBadge (`/15` fill, `/25` border) so
 * a platform chip reads as one of the family rather than a new widget.
 *
 * Web and mobile get distinct hues because telling them apart at a glance is
 * the whole point of the column; UNKNOWN is deliberately muted — it means the
 * request carried no platform signal (an old client, or a call that never
 * went through one), which is an absence, not a third product.
 */
const PLATFORM_STYLES: Record<ClientPlatform, string> = {
  WEB: "bg-chart-2/15 text-chart-2 border-chart-2/25",
  MOBILE: "bg-chart-3/15 text-chart-3 border-chart-3/25",
  UNKNOWN:
    "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/25",
};

const PLATFORM_ICONS: Record<ClientPlatform, LucideIcon> = {
  WEB: Globe,
  MOBILE: Smartphone,
  UNKNOWN: CircleHelp,
};

/**
 * Where a tracked action came from — Website, Mobile or Unknown.
 *
 * Shared by all six Tracking screens, because "web vs mobile must be
 * distinguishable everywhere" only holds if one component decides what that
 * looks like. Purely cosmetic; it gates nothing.
 */
export function PlatformChip({
  platform,
  showIcon = true,
  className,
}: {
  platform: ClientPlatform;
  /** Drop the icon in dense contexts (a chart legend, a tight cell). */
  showIcon?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();
  const Icon = PLATFORM_ICONS[platform];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", PLATFORM_STYLES[platform], className)}
    >
      {showIcon ? <Icon aria-hidden="true" /> : null}
      {t.tracking.platform[platform]}
    </Badge>
  );
}

/**
 * A user's or a term's full platform set — one user on web AND mobile is one
 * row with two chips, never two rows.
 *
 * Rendered in `CLIENT_PLATFORMS` order rather than the order the server
 * happened to accumulate them, so a row's chips do not reshuffle between
 * refreshes. An empty set renders nothing.
 */
export function PlatformChips({
  platforms,
  showIcon = true,
  className,
}: {
  platforms: ClientPlatform[];
  showIcon?: boolean;
  className?: string;
}) {
  const ordered = (["WEB", "MOBILE", "UNKNOWN"] as const).filter((platform) =>
    platforms.includes(platform),
  );
  if (ordered.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {ordered.map((platform) => (
        <PlatformChip key={platform} platform={platform} showIcon={showIcon} />
      ))}
    </div>
  );
}
