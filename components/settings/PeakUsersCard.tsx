"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/context/role-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { ApiError } from "@/services/api/apiClient";
import { peakUsersService } from "@/services/api/peakUsersService";
import type { PeakUsersAdminView } from "@/types/peak-users";
import { toast } from "sonner";

/**
 * SUPER_ADMIN-only card on the Settings page controlling the "peak users"
 * number the public site displays: a tracked actual peak (read-only) plus
 * an admin-adjustable additional amount, mirroring the Finance Limits
 * page's load/override/save pattern.
 */
export function PeakUsersCard() {
  const { can } = useRole();
  const canManage = can("PEAK_USERS.MANAGE");
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(
    () => peakUsersService.getAdmin(),
    [],
  );

  // Same override pattern as the Finance Limits page: the input shows the
  // loaded value until the admin types, and a successful save replaces the
  // loaded data without waiting on a refetch.
  const [savedView, setSavedView] = useState<PeakUsersAdminView | null>(null);
  const [additionalOverride, setAdditionalOverride] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const view = savedView ?? data;
  const additional = additionalOverride ?? (view ? String(view.additionalPeak) : "");

  const parsedAdditional = Number(additional);
  const additionalValid =
    additional.trim() !== "" && Number.isInteger(parsedAdditional) && parsedAdditional >= 0;
  const displayedPeak =
    view && additionalValid ? view.actualPeak + parsedAdditional : null;

  const handleSave = async () => {
    if (!additionalValid) return;
    setSaving(true);
    try {
      const saved = await peakUsersService.updateAdditional(parsedAdditional);
      setSavedView(saved);
      setAdditionalOverride(null);
      toast.success(t.settings.peakUsers.updatedToast);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.common.somethingWentWrong);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <ErrorState
        className="max-w-2xl"
        description={t.settings.peakUsers.loadError}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !view) {
    return <Skeleton className="h-72 max-w-2xl rounded-lg" />;
  }

  return (
    <Card className="glass-card max-w-2xl">
      <CardHeader>
        <CardTitle>{t.settings.peakUsers.cardTitle}</CardTitle>
        <CardDescription>{t.settings.peakUsers.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-primary">
              <TrendingUp className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-medium">{t.settings.peakUsers.actualPeakLabel}</p>
              <p className="text-xs text-muted-foreground">
                {view.actualPeakAt
                  ? t.settings.peakUsers.sinceDate(
                      format(new Date(view.actualPeakAt), "d MMM yyyy"),
                    )
                  : t.settings.peakUsers.notRecordedYet}
              </p>
            </div>
          </div>
          <p className="text-lg font-semibold tabular-nums">
            {view.actualPeak.toLocaleString("en-US")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="additional-peak">{t.settings.peakUsers.additionalLabel}</Label>
          <Input
            id="additional-peak"
            type="number"
            min="0"
            step="1"
            value={additional}
            onChange={(e) => setAdditionalOverride(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t.settings.peakUsers.additionalHint}</p>
          {!additionalValid && (
            <p className="text-sm text-destructive">{t.settings.peakUsers.invalidValue}</p>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t.settings.peakUsers.displayedLabel}</p>
            <p className="text-xs text-muted-foreground">{t.settings.peakUsers.displayedHint}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-primary">
            {displayedPeak !== null ? displayedPeak.toLocaleString("en-US") : "—"}
          </p>
        </div>

        <div>
          <Button onClick={handleSave} disabled={saving || !additionalValid || !canManage}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t.settings.peakUsers.saveChanges}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
