"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/user";

const ROLE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-primary/15 text-primary border-primary/25",
  ADMIN: "bg-chart-5/15 text-chart-5 border-chart-5/25",
  USER: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/25",
  CONTENT_UPLOADER: "bg-chart-2/15 text-chart-2 border-chart-2/25",
};

/**
 * Purely cosmetic — it never gates anything. `role` picks the colour (the
 * account kind), while `label` lets a caller show the assigned AppRole's own
 * name instead, which is the only way a custom role like "Movie Manager"
 * reads correctly on a staff account whose enum role is still ADMIN.
 */
export function RoleBadge({
  role,
  label,
  className,
}: {
  role: UserRole;
  label?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ROLE_STYLES[role], className)}
    >
      {label ?? t.common.roleLabels[role]}
    </Badge>
  );
}
