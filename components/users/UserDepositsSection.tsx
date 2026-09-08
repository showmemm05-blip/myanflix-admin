"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { getDepositColumns } from "@/components/deposits/columns";
import { RejectDepositDialog } from "@/components/deposits/RejectDepositDialog";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { depositService } from "@/services/api/depositService";
import type { Deposit } from "@/types/deposit";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

/**
 * One user's deposit history, rendered with THE SAME column factory, cells,
 * dialogs and permission gates as the main /deposits queue — reuse, not a
 * copy, so the two surfaces can never drift apart again.
 *
 * The one deliberate difference from the main page: successful actions call
 * `onChanged` (the profile page's refetch) instead of patching local list
 * state, because approving/rejecting here must also refresh the balance
 * card, finance summary, level card and transactions on the same page.
 */
export function UserDepositsSection({
  deposits,
  types,
  paymentAccounts,
  onChanged,
}: {
  deposits: Deposit[];
  types: PaymentAccountType[];
  paymentAccounts: PaymentAccount[];
  onChanged: () => void;
}) {
  const { can } = useRole();
  const { t } = useLanguage();

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);

  const handleApprove = async (deposit: Deposit) => {
    setApprovingId(deposit.id);
    try {
      // No account picker anymore — the depositor already declared which of
      // our payment accounts they sent to when submitting, and the backend
      // auto-credits that declared account on approval.
      await depositService.approve(deposit.id);
      toast.success(t.deposits.approvedToast, {
        description: t.deposits.approvedDescription(deposit.userName),
      });
      onChanged();
    } catch (err) {
      toast.error(t.deposits.approveFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const columns = getDepositColumns({
    t,
    types,
    paymentAccounts,
    canApprove: can("DEPOSITS.APPROVE"),
    canReject: can("DEPOSITS.REJECT"),
    onApprove: handleApprove,
    onReject: setRejectTarget,
    onReceivingSaved: onChanged,
    approvingId,
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t.users.depositsTable.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={deposits}
          searchKey="userName"
          searchPlaceholder={t.deposits.searchPlaceholder}
        />
      </CardContent>

      <RejectDepositDialog
        deposit={rejectTarget}
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        onRejected={onChanged}
      />
    </Card>
  );
}
