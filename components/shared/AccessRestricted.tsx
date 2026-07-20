import { ShieldAlert } from "lucide-react";
import { RoleBadge } from "@/components/shared/RoleBadge";
import type { UserRole } from "@/types/user";

export function AccessRestricted({ role }: { role: UserRole }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <ShieldAlert className="size-6" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">You don&apos;t have access to this page</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This section requires a higher permission level than your current role.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <RoleBadge role={role} />
        </div>
      </div>
    </div>
  );
}
