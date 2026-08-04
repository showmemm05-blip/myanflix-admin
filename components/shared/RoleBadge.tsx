import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type UserRole } from "@/types/user";

const ROLE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-primary/15 text-primary border-primary/30",
  ADMIN: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  USER: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  CONTENT_UPLOADER: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ROLE_STYLES[role], className)}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}
