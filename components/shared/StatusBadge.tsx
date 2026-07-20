import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

const DOT_STYLES: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-sky-400",
  neutral: "bg-muted-foreground",
};

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium capitalize", TONE_STYLES[tone], className)}
    >
      <span className={cn("size-1.5 rounded-full", DOT_STYLES[tone])} />
      {label}
    </Badge>
  );
}
