"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Loader2, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { formatKyat } from "@/lib/currency";
import { subscriptionService } from "@/services/api/subscriptionService";
import type { SubscriptionPlan } from "@/types/subscription";
import { toast } from "sonner";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";

const DEFAULT_DURATION_DAYS = 30;
const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 3650;
const DURATION_PRESETS = [7, 30, 90, 180, 365];

function SubscriptionsPageContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("SUBSCRIPTIONS.CREATE");
  const canEdit = can("SUBSCRIPTIONS.EDIT");
  const { data, isLoading, error, refetch } = useAsyncData(subscriptionService.getPlans, []);
  const plans = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [durationInput, setDurationInput] = useState(String(DEFAULT_DURATION_DAYS));
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const durationDays = Number(durationInput);
  const durationValid =
    durationInput.trim() !== "" &&
    Number.isInteger(durationDays) &&
    durationDays >= MIN_DURATION_DAYS &&
    durationDays <= MAX_DURATION_DAYS;
  const showDurationError = durationInput.trim() !== "" && !durationValid;

  const openCreate = () => {
    setEditing(null);
    setNameInput("");
    setPriceInput("");
    setDurationInput(String(DEFAULT_DURATION_DAYS));
    setFormOpen(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditing(plan);
    setNameInput(plan.name);
    setPriceInput(String(plan.price));
    setDurationInput(String(plan.durationDays));
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim() || !durationValid) return;
    setSaving(true);
    try {
      if (editing) {
        await subscriptionService.updatePlan(editing.id, {
          name: nameInput.trim(),
          price: Number(priceInput) || 0,
          durationDays,
        });
        toast.success(t.subscriptions.updatedToast);
      } else {
        await subscriptionService.createPlan({
          name: nameInput.trim(),
          price: Number(priceInput) || 0,
          durationDays,
        });
        toast.success(t.subscriptions.createdToast);
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.somethingWentWrong);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan, isActive: boolean) => {
    setTogglingId(plan.id);
    try {
      await subscriptionService.updatePlan(plan.id, { isActive });
      toast.success(isActive ? t.subscriptions.toggleEnabledToast : t.subscriptions.toggleDisabledToast, {
        description: t.subscriptions.toggleDescription(plan.name, isActive),
      });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.subscriptions.toggleFailedToast);
    } finally {
      setTogglingId(null);
    }
  };

  const columns: ColumnDef<SubscriptionPlan>[] = [
    {
      accessorKey: "name",
      header: t.subscriptions.columns.name,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "price",
      header: t.subscriptions.columns.price,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{formatKyat(row.original.price)}</span>
      ),
    },
    {
      accessorKey: "durationDays",
      header: t.subscriptions.columns.duration,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {t.subscriptions.durationLabel(row.original.durationDays)}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t.subscriptions.columns.status,
      cell: ({ row }) => {
        const plan = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <Switch
              checked={plan.isActive}
              disabled={togglingId === plan.id || !canEdit}
              onCheckedChange={(checked) => handleToggleActive(plan, checked)}
            />
            <span className="text-sm text-muted-foreground">
              {plan.isActive ? t.common.active : t.subscriptions.columns.disabled}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        canEdit ? (
          <RowActions>
            <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => openEdit(row.original)} />
          </RowActions>
        ) : null,
    },
  ];

  if (error) {
    return (
      <div>
        <PageHeader title={t.subscriptions.page.title} description={t.subscriptions.page.description} />
        <ErrorState description={t.subscriptions.page.loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.subscriptions.page.title}
        description={t.subscriptions.page.description}
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t.subscriptions.page.addPlan}
            </Button>
          )
        }
      />

      {!isLoading && plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t.subscriptions.page.emptyTitle}
          description={t.subscriptions.page.emptyDescription}
          action={
            canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                {t.subscriptions.page.addPlan}
              </Button>
            )
          }
        />
      ) : (
        <DataTable columns={columns} data={plans} isLoading={isLoading} />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.subscriptions.form.editTitle : t.subscriptions.form.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-name">{t.subscriptions.form.nameLabel}</Label>
              <Input
                id="plan-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t.subscriptions.form.namePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-price">{t.subscriptions.form.priceLabel}</Label>
              <Input
                id="plan-price"
                type="number"
                min="0"
                step="1"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-duration">{t.subscriptions.form.durationLabel}</Label>
              <Input
                id="plan-duration"
                type="number"
                min={MIN_DURATION_DAYS}
                max={MAX_DURATION_DAYS}
                step="1"
                inputMode="numeric"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                aria-invalid={showDurationError || undefined}
                aria-describedby={
                  showDurationError ? "plan-duration-hint plan-duration-error" : "plan-duration-hint"
                }
              />
              <p id="plan-duration-hint" className="text-xs text-muted-foreground">
                {t.subscriptions.form.durationHint}
              </p>
              {showDurationError && (
                <p id="plan-duration-error" className="text-xs text-destructive">
                  {t.subscriptions.form.durationInvalid}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">{t.subscriptions.form.durationPresets}</span>
                {DURATION_PRESETS.map((n) => {
                  const selected = durationDays === n;
                  return (
                    <Button
                      key={n}
                      type="button"
                      variant={selected ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={selected}
                      onClick={() => setDurationInput(String(n))}
                    >
                      {t.subscriptions.durationLabel(n)}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !nameInput.trim() || !durationValid}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? t.common.save : t.subscriptions.form.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="SUBSCRIPTIONS.VIEW"
      title={t.subscriptions.page.title}
      description={t.subscriptions.page.description}
    >
      <SubscriptionsPageContent />
    </RequirePermission>
  );
}
