"use client";

import { ShieldAlert } from "lucide-react";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useLanguage } from "@/lib/context/language-context";
import type { UserRole } from "@/types/user";

export function AccessRestricted({ role }: { role: UserRole }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary">
        <ShieldAlert className="size-6" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t.shared.noAccessTitle}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t.shared.noAccessDescription}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">{t.shared.signedInAs}</span>
          <RoleBadge role={role} />
        </div>
      </div>
    </div>
  );
}
