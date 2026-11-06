import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnalyticsCardProps {
  title: string;
  description?: string;
  /** Top-right: the Export CSV button, a toggle, a badge. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /**
   * A refetch is running with the previous data still drawn: the body stays
   * in place at reduced opacity (the boards' "refreshing" state — no
   * skeleton, no jump) and says so to assistive tech.
   */
  refreshing?: boolean;
}

/**
 * One analytics section: the boards' card with a title, its one-line
 * description and the actions in the corner. Every section on both pages
 * is one of these, so they line up and wrap the same way at phone width
 * (the actions drop under the title).
 */
export function AnalyticsCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  refreshing = false,
}: AnalyticsCardProps) {
  return (
    <Card className={cn("glass-card", className)}>
      <CardHeader>
        {/* Not CardAction: its auto column would squeeze a long title beside three controls on a phone — here the actions wrap under the title instead. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent
        className={cn("flex flex-col gap-4 transition-opacity", refreshing && "opacity-60", contentClassName)}
        aria-busy={refreshing || undefined}
      >
        {children}
      </CardContent>
    </Card>
  );
}
