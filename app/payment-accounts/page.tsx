"use client";

import { useMemo, useState } from "react";
import { Landmark, Plus, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequireRole } from "@/components/shared/RequireRole";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/DataTable";
import { getPaymentAccountColumns } from "@/components/payment-accounts/columns";
import { PaymentAccountFormDialog } from "@/components/payment-accounts/PaymentAccountFormDialog";
import { ManagePaymentMethodsDialog } from "@/components/payment-accounts/ManagePaymentMethodsDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { ApiError } from "@/services/api/apiClient";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

export default function PaymentAccountsPage() {
  const { data, isLoading, error, refetch } = useAsyncData(
    () => paymentAccountService.getAccounts(),
    [],
  );
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<PaymentAccountType[] | null>(null);
  const activeAccounts = useMemo(() => accounts ?? data ?? [], [accounts, data]);
  const availableTypes = typeOverrides ?? types ?? [];

  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const account of activeAccounts) {
      counts[account.type] = (counts[account.type] ?? 0) + 1;
    }
    return counts;
  }, [activeAccounts]);

  const [formOpen, setFormOpen] = useState(false);
  const [manageMethodsOpen, setManageMethodsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentAccount | null>(null);
  const [statusTarget, setStatusTarget] = useState<PaymentAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentAccount | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleSaved = (saved: PaymentAccount) => {
    const exists = activeAccounts.some((a) => a.id === saved.id);
    setAccounts(
      exists
        ? activeAccounts.map((a) => (a.id === saved.id ? saved : a))
        : [saved, ...activeAccounts],
    );
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setStatusSubmitting(true);
    try {
      const updated = await paymentAccountService.updateAccount(statusTarget.id, {
        isActive: !statusTarget.isActive,
      });
      setAccounts(activeAccounts.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(updated.isActive ? "Account activated" : "Account deactivated", {
        description: `${statusTarget.accountName} is now ${updated.isActive ? "visible" : "hidden"} to users.`,
      });
      setStatusTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await paymentAccountService.deleteAccount(deleteTarget.id);
      setAccounts(activeAccounts.filter((a) => a.id !== deleteTarget.id));
      toast.success("Payment account deleted", { description: `${deleteTarget.accountName} has been removed.` });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = getPaymentAccountColumns({
    types: availableTypes,
    onEdit: (account) => {
      setEditTarget(account);
      setFormOpen(true);
    },
    onToggleStatus: setStatusTarget,
    onDelete: setDeleteTarget,
  });

  return (
    <RequireRole
      allow={["SUPER_ADMIN"]}
      title="Payment Accounts"
      description="Manage the accounts users send deposits to."
    >
      {error ? (
        <div>
          <PageHeader title="Payment Accounts" description="Manage the accounts users send deposits to." />
          <ErrorState description="We couldn't load payment accounts." onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title="Payment Accounts"
            description="Manage the destinations users see when depositing into their wallet. Only active accounts are shown to users."
            actions={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setManageMethodsOpen(true)}>
                  <Settings2 className="size-4" />
                  Manage Methods
                </Button>
                <Button
                  onClick={() => {
                    setEditTarget(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Add Account
                </Button>
              </div>
            }
          />

          {!isLoading && activeAccounts.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No payment accounts yet"
              description="Add a payment account so users have somewhere to send deposits."
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeAccounts}
              isLoading={isLoading}
              searchKey="accountName"
              searchPlaceholder="Search by account name..."
            />
          )}

          <ManagePaymentMethodsDialog
            open={manageMethodsOpen}
            onOpenChange={setManageMethodsOpen}
            types={availableTypes}
            accountCounts={accountCounts}
            onTypesChanged={setTypeOverrides}
            onAccountsRenamed={(previousLabel, nextLabel) =>
              setAccounts(
                activeAccounts.map((a) => (a.type === previousLabel ? { ...a, type: nextLabel } : a)),
              )
            }
          />

          <PaymentAccountFormDialog
            account={editTarget}
            types={availableTypes}
            open={formOpen}
            onOpenChange={(o) => {
              setFormOpen(o);
              if (!o) setEditTarget(null);
            }}
            onSaved={handleSaved}
          />

          <ConfirmDialog
            open={!!statusTarget}
            onOpenChange={(o) => !o && setStatusTarget(null)}
            title={statusTarget?.isActive ? "Deactivate this account?" : "Activate this account?"}
            description={
              statusTarget?.isActive
                ? `${statusTarget?.accountName} will no longer be shown to users making a deposit.`
                : `${statusTarget?.accountName} will be shown to users making a deposit.`
            }
            confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
            variant={statusTarget?.isActive ? "destructive" : "default"}
            loading={statusSubmitting}
            onConfirm={handleToggleStatus}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title="Delete this payment account?"
            description={`${deleteTarget?.accountName} will be permanently removed. This action cannot be undone.`}
            confirmLabel="Delete"
            variant="destructive"
            loading={deleteSubmitting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequireRole>
  );
}
