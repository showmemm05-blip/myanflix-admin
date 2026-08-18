"use client";

import { useMemo, useState } from "react";
import { Landmark, Plus, Settings2 } from "lucide-react";
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
import { useLanguage } from "@/lib/context/language-context";

export default function PaymentAccountsPage() {
  const { t } = useLanguage();
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
      toast.success(
        updated.isActive
          ? t.paymentAccounts.toggleStatus.activatedToast
          : t.paymentAccounts.toggleStatus.deactivatedToast,
        {
          description: updated.isActive
            ? t.paymentAccounts.toggleStatus.activatedDescription(statusTarget.accountName)
            : t.paymentAccounts.toggleStatus.deactivatedDescription(statusTarget.accountName),
        },
      );
      setStatusTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.common.somethingWentWrong);
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
      toast.success(t.paymentAccounts.deleteAccount.deletedToast, {
        description: t.paymentAccounts.deleteAccount.deletedDescription(deleteTarget.accountName),
      });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.common.somethingWentWrong);
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
    t,
  });

  // Both actions live in the table's search row, pushed to the right end
  // (DataTable spreads search-left / actions-right when there is no toolbar).
  const pageActions = (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="outline" onClick={() => setManageMethodsOpen(true)}>
        <Settings2 className="size-4" />
        {t.paymentAccounts.page.manageMethods}
      </Button>
      <Button
        onClick={() => {
          setEditTarget(null);
          setFormOpen(true);
        }}
      >
        <Plus className="size-4" />
        {t.paymentAccounts.page.addAccount}
      </Button>
    </div>
  );

  return (
    <RequireRole
      allow={["SUPER_ADMIN"]}
      title={t.paymentAccounts.page.title}
      description={t.paymentAccounts.page.description}
    >
      {error ? (
        <div>
          <ErrorState description={t.paymentAccounts.page.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          {!isLoading && activeAccounts.length === 0 ? (
            // The table (and its search-row actions) is hidden here — keep
            // the buttons reachable so the first account can be added.
            <div className="flex flex-col gap-4">
              <div className="flex justify-end gap-2">{pageActions}</div>
              <EmptyState
                icon={Landmark}
                title={t.paymentAccounts.page.emptyTitle}
                description={t.paymentAccounts.page.emptyDescription}
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={activeAccounts}
              isLoading={isLoading}
              searchKey="accountName"
              searchPlaceholder={t.paymentAccounts.page.searchPlaceholder}
              searchActions={pageActions}
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
            title={
              statusTarget?.isActive
                ? t.paymentAccounts.toggleStatus.deactivateTitle
                : t.paymentAccounts.toggleStatus.activateTitle
            }
            description={
              statusTarget?.isActive
                ? t.paymentAccounts.toggleStatus.deactivateDescription(statusTarget?.accountName ?? "")
                : t.paymentAccounts.toggleStatus.activateDescription(statusTarget?.accountName ?? "")
            }
            confirmLabel={
              statusTarget?.isActive
                ? t.paymentAccounts.toggleStatus.deactivate
                : t.paymentAccounts.toggleStatus.activate
            }
            variant={statusTarget?.isActive ? "destructive" : "default"}
            loading={statusSubmitting}
            onConfirm={handleToggleStatus}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={t.paymentAccounts.deleteAccount.title}
            description={t.paymentAccounts.deleteAccount.description(deleteTarget?.accountName ?? "")}
            confirmLabel={t.common.delete}
            variant="destructive"
            loading={deleteSubmitting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequireRole>
  );
}
