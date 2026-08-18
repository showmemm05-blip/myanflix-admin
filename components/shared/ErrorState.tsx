import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const { t } = useLanguage();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/12 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title ?? t.shared.errorTitle}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description ?? t.shared.errorDescription}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-4" />
          {t.shared.tryAgain}
        </Button>
      )}
    </div>
  );
}
