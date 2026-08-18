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

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const { t } = useLanguage();
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ROLE_STYLES[role], className)}
    >
      {t.common.roleLabels[role]}
    </Badge>
  );
}
