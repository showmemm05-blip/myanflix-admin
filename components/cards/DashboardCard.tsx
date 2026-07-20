import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trendPercent?: number;
  trendLabel?: string;
  iconClassName?: string;
  className?: string;
}

export function DashboardCard({
  title,
  value,
  icon: Icon,
  trendPercent,
  trendLabel = "vs last month",
  iconClassName,
  className,
}: DashboardCardProps) {
  const trendDirection =
    trendPercent === undefined || trendPercent === 0
      ? "neutral"
      : trendPercent > 0
        ? "up"
        : "down";

  return (
    <Card className={cn("glass-card border-white/[0.08] py-0", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</p>
          {trendPercent !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                  trendDirection === "up" && "bg-success/15 text-success",
                  trendDirection === "down" && "bg-destructive/15 text-destructive",
                  trendDirection === "neutral" && "bg-muted text-muted-foreground"
                )}
              >
                {trendDirection === "up" && <ArrowUpRight className="size-3" />}
                {trendDirection === "down" && <ArrowDownRight className="size-3" />}
                {trendDirection === "neutral" && <Minus className="size-3" />}
                {Math.abs(trendPercent).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">{trendLabel}</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary",
            iconClassName
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
