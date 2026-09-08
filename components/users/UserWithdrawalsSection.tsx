"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { getWithdrawalColumns } from "@/components/withdrawals/columns";
import { RejectWithdrawalDialog } from "@/components/withdrawals/RejectWithdrawalDialog";
import { ViewWithdrawalDialog } from "@/components/withdrawals/ViewWithdrawalDialog";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { withdrawalService } from "@/services/api/withdrawalService";
import type { Withdrawal } from "@/types/withdrawal";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

/**
 * One user's withdrawal history, rendered with THE SAME column factory,
 * cells, dialogs and permission gates as the main /withdrawals queue —
 * reuse, not a copy, so the two surfaces can never drift apart again.
 *
 * The one deliberate difference from the main page: successful actions call
 * `onChanged` (the profile page's refetch) instead of patching local list
 * state, because approving/rejecting here must also refresh the balance
 * card, finance summary, level card and transactions on the same page.
 */
export function UserWithdrawalsSection({
  withdrawals,
  types,
  paymentAccounts,
  onChanged,
}: {
  withdrawals: Withdrawal[];
  types: PaymentAccountType[];
  paymentAccounts: PaymentAccount[];
  onChanged: () => void;
}) {
  const { can } = useRole();
  const { t } = useLanguage();

  const [viewTarget, setViewTarget] = useState<Withdrawal | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);

  const handleApprove = async (withdrawal: Withdrawal) => {
    setApprovingId(withdrawal.id);
    try {
      await withdrawalService.approve(withdrawal.id);
      toast.success(t.withdrawals.approvedToast, {
        description: t.withdrawals.approvedDescription(withdrawal.userName),
      });
      onChanged();
    } catch (err) {
      toast.error(t.withdrawals.approveFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const columns = getWithdrawalColumns({
    t,
    types,
    paymentAccounts,
    onView: setViewTarget,
    canApprove: can("WITHDRAWALS.APPROVE"),
    canReject: can("WITHDRAWALS.REJECT"),
    onApprove: handleApprove,
    onReject: setRejectTarget,
    onTransferSaved: onChanged,
    approvingId,
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t.users.withdrawalsTable.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={withdrawals}
          searchKey="userName"
          searchPlaceholder={t.withdrawals.searchPlaceholder}
        />
      </CardContent>

      <ViewWithdrawalDialog
        withdrawal={viewTarget}
        open={viewTarget !== null}
        onOpenChange={(open) => !open && setViewTarget(null)}
      />

      <RejectWithdrawalDialog
        withdrawal={rejectTarget}
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        onRejected={onChanged}
      />
    </Card>
  );
}
