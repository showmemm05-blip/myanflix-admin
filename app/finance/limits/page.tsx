"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequireRole } from "@/components/shared/RequireRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { ApiError } from "@/services/api/apiClient";
import { financeSettingsService } from "@/services/api/financeSettingsService";
import type { FinanceSettings } from "@/types/finance-settings";
import { toast } from "sonner";

function LimitsPageContent() {
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
      toast.success("Limits updated");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader
          title="Deposit & Withdrawal Limits"
          description="Control the minimum and maximum amounts users can deposit or withdraw."
        />
        <ErrorState description="We couldn't load the current limits." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Deposit & Withdrawal Limits"
        description="Control the minimum and maximum amounts users can deposit or withdraw."
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Deposit Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="min-deposit">Minimum Deposit Amount (Ks)</Label>
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
                  <Label htmlFor="max-deposit">Maximum Deposit Amount (Ks)</Label>
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
                  Minimum deposit amount cannot be greater than the maximum.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="min-withdrawal">Minimum Withdrawal Amount (Ks)</Label>
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
                  <Label htmlFor="max-withdrawal">Maximum Withdrawal Amount (Ks)</Label>
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
                  Minimum withdrawal amount cannot be greater than the maximum.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {settings?.updatedBy
                ? `Last updated by ${settings.updatedBy.username} on ${format(new Date(settings.updatedAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Not yet customized — showing default limits."}
            </p>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LimitsPage() {
  return (
    <RequireRole
      allow={["SUPER_ADMIN"]}
      title="Deposit & Withdrawal Limits"
      description="Control the minimum and maximum amounts users can deposit or withdraw."
    >
      <LimitsPageContent />
    </RequireRole>
  );
}
