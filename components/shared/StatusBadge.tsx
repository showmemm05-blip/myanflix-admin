import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  danger: "bg-destructive/15 text-destructive border-destructive/25",
  info: "bg-info/15 text-info border-info/25",
  neutral: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/25",
};

const DOT_STYLES: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
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
