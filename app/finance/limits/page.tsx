"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { userLabel } from "@/lib/user-label";
import { ApiError } from "@/services/api/apiClient";
import { financeSettingsService } from "@/services/api/financeSettingsService";
import type { FinanceSettings } from "@/types/finance-settings";
import { toast } from "sonner";

function LimitsPageContent() {
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(
    () => financeSettingsService.get(),
    [],
  );

  // Overrides start out unset (null) so the inputs render whatever `data`
  // just loaded; once the admin types into a field, its override takes
  // over. `savedSettings` replaces `data` as the source of truth right
  // after a successful save, without waiting on a refetch.
  const [savedSettings, setSavedSettings] = useState<FinanceSettings | null>(null);
  const [minDepositOverride, setMinDepositOverride] = useState<string | null>(null);
  const [maxDepositOverride, setMaxDepositOverride] = useState<string | null>(null);
  const [minWithdrawalOverride, setMinWithdrawalOverride] = useState<string | null>(null);
  const [maxWithdrawalOverride, setMaxWithdrawalOverride] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const settings = savedSettings ?? data;
  const minDeposit = minDepositOverride ?? (settings ? String(settings.minDepositAmount) : "");
  const maxDeposit = maxDepositOverride ?? (settings ? String(settings.maxDepositAmount) : "");
  const minWithdrawal =
    minWithdrawalOverride ?? (settings ? String(settings.minWithdrawalAmount) : "");
  const maxWithdrawal =
    maxWithdrawalOverride ?? (settings ? String(settings.maxWithdrawalAmount) : "");

  const depositInvalid = Number(minDeposit) > Number(maxDeposit);
  const withdrawalInvalid = Number(minWithdrawal) > Number(maxWithdrawal);
  const canSave = !depositInvalid && !withdrawalInvalid;

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const saved = await financeSettingsService.update({
        minDepositAmount: Number(minDeposit) || 0,
        maxDepositAmount: Number(maxDeposit) || 0,
        minWithdrawalAmount: Number(minWithdrawal) || 0,
        maxWithdrawalAmount: Number(maxWithdrawal) || 0,
      });
      setSavedSettings(saved);
      setMinDepositOverride(null);
      setMaxDepositOverride(null);
      setMinWithdrawalOverride(null);
      setMaxWithdrawalOverride(null);
      toast.success(t.finance.limits.updatedToast);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t.login.genericError);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader
          title={t.finance.limits.title}
          description={t.finance.limits.description}
        />
        <ErrorState description={t.finance.limits.loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.finance.limits.title}
        description={t.finance.limits.description}
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.finance.limits.depositLimitsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="min-deposit">{t.finance.limits.minDepositLabel}</Label>
                  <Input
                    id="min-deposit"
                    type="number"
                    min="0"
                    step="1000"
                    value={minDeposit}
                    onChange={(e) => setMinDepositOverride(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="max-deposit">{t.finance.limits.maxDepositLabel}</Label>
                  <Input
                    id="max-deposit"
                    type="number"
                    min="0"
                    step="1000"
                    value={maxDeposit}
                    onChange={(e) => setMaxDepositOverride(e.target.value)}
                  />
                </div>
              </div>
              {depositInvalid && (
                <p className="mt-2 text-sm text-destructive">
                  {t.finance.limits.depositInvalid}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.finance.limits.withdrawalLimitsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="min-withdrawal">{t.finance.limits.minWithdrawalLabel}</Label>
                  <Input
                    id="min-withdrawal"
                    type="number"
                    min="0"
                    step="1000"
                    value={minWithdrawal}
                    onChange={(e) => setMinWithdrawalOverride(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="max-withdrawal">{t.finance.limits.maxWithdrawalLabel}</Label>
                  <Input
                    id="max-withdrawal"
                    type="number"
                    min="0"
                    step="1000"
                    value={maxWithdrawal}
                    onChange={(e) => setMaxWithdrawalOverride(e.target.value)}
                  />
                </div>
              </div>
              {withdrawalInvalid && (
                <p className="mt-2 text-sm text-destructive">
                  {t.finance.limits.withdrawalInvalid}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {settings?.updatedBy
                ? t.finance.limits.lastUpdatedBy(
                    userLabel(settings.updatedBy),
                    format(new Date(settings.updatedAt), "d MMM yyyy, HH:mm:ss"),
                  )
                : t.finance.limits.notCustomized}
            </p>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t.finance.limits.saveChanges}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LimitsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="FINANCE.SETTINGS_MANAGE"
      title={t.finance.limits.title}
      description={t.finance.limits.description}
    >
      <LimitsPageContent />
    </RequirePermission>
  );
}
