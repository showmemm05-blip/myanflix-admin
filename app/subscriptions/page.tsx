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

function SubscriptionsPageContent() {
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
        toast.success("Plan updated");
      } else {
        await subscriptionService.createPlan({
          name: nameInput.trim(),
          price: Number(priceInput) || 0,
        });
        toast.success("Plan created");
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan, isActive: boolean) => {
    setTogglingId(plan.id);
    try {
      await subscriptionService.updatePlan(plan.id, { isActive });
      toast.success(isActive ? "Plan enabled" : "Plan disabled", {
        description: `"${plan.name}" is now ${isActive ? "available to subscribe to" : "hidden from new subscribers"}.`,
      });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the plan");
    } finally {
      setTogglingId(null);
    }
  };

  const columns: ColumnDef<SubscriptionPlan>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatKyat(row.original.price)}
          <span className="ml-1 text-xs">/ 30 days</span>
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
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
              {plan.isActive ? "Active" : "Disabled"}
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
                Edit
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
        <PageHeader title="Subscriptions" description="Manage monthly subscription plans." />
        <ErrorState description="We couldn't load subscription plans." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Manage monthly subscription plans."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Plan
          </Button>
        }
      />

      {!isLoading && plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No subscription plans yet"
          description="Create a plan so users can subscribe to premium content."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add Plan
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={plans} isLoading={isLoading} />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan" : "Add plan"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Premium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-price">Price (Ks) — per 30 days</Label>
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
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !nameInput.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN"]}
      title="Subscriptions"
      description="Manage monthly subscription plans."
    >
      <SubscriptionsPageContent />
    </RequireRole>
  );
}
