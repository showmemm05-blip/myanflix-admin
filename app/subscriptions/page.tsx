"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Loader2, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequireRole } from "@/components/shared/RequireRole";
import { DataTable } from "@/components/tables/DataTable";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { formatKyat } from "@/lib/currency";
import { subscriptionService } from "@/services/api/subscriptionService";
import type { SubscriptionPlan } from "@/types/subscription";
import { toast } from "sonner";
import { useLanguage } from "@/lib/context/language-context";

function SubscriptionsPageContent() {
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(subscriptionService.getPlans, []);
  const plans = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setNameInput("");
    setPriceInput("");
    setFormOpen(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditing(plan);
    setNameInput(plan.name);
    setPriceInput(String(plan.price));
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await subscriptionService.updatePlan(editing.id, {
          name: nameInput.trim(),
          price: Number(priceInput) || 0,
        });
        toast.success(t.subscriptions.updatedToast);
      } else {
        await subscriptionService.createPlan({
          name: nameInput.trim(),
          price: Number(priceInput) || 0,
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
        <span className="tabular-nums text-muted-foreground">
          {formatKyat(row.original.price)}
          <span className="ml-1 text-xs">{t.subscriptions.columns.perDays}</span>
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
              disabled={togglingId === plan.id}
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
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="size-4" />
                {t.common.edit}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
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
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t.subscriptions.page.addPlan}
          </Button>
        }
      />

      {!isLoading && plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t.subscriptions.page.emptyTitle}
          description={t.subscriptions.page.emptyDescription}
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t.subscriptions.page.addPlan}
            </Button>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !nameInput.trim()}>
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
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN"]}
      title={t.subscriptions.page.title}
      description={t.subscriptions.page.description}
    >
      <SubscriptionsPageContent />
    </RequireRole>
  );
}
