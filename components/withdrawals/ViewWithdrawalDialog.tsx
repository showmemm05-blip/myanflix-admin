"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { REVIEW_STATUS_TONE as STATUS_TONE } from "@/lib/status-tones";
import { formatLocalPhone } from "@/lib/phone";
import { useLanguage } from "@/lib/context/language-context";
import type { Withdrawal } from "@/types/withdrawal";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ViewWithdrawalDialog({
  withdrawal,
  open,
  onOpenChange,
}: {
  withdrawal: Withdrawal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {withdrawal && (
          <>
            <DialogHeader>
              <DialogTitle>{t.withdrawals.viewDialog.title}</DialogTitle>
              <DialogDescription>{t.withdrawals.viewDialog.description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col">
              {/* Label first, login identity underneath — two customers may
                  both call themselves "Blake", and a payout must never be
                  approved against a name that can't be tied to an account. */}
              <Row
                label={t.withdrawals.viewDialog.user}
                value={
                  <span className="flex flex-col items-end">
                    <span>{withdrawal.userName}</span>
                    {withdrawal.userUsername && (
                      <span className="text-xs font-normal text-muted-foreground">
                        @{withdrawal.userUsername}
                      </span>
                    )}
                  </span>
                }
              />
              {withdrawal.userPhone || !withdrawal.userEmail ? (
                <Row label={t.withdrawals.viewDialog.phone} value={formatLocalPhone(withdrawal.userPhone) || "—"} />
              ) : (
                <Row label={t.withdrawals.viewDialog.email} value={withdrawal.userEmail} />
              )}
              <Row label={t.withdrawals.viewDialog.amount} value={formatKyat(withdrawal.amount)} />
              <Row
                label={t.withdrawals.viewDialog.status}
                value={<StatusBadge label={withdrawal.status} tone={STATUS_TONE[withdrawal.status]} />}
              />
              <Row label={t.withdrawals.viewDialog.requested} value={format(new Date(withdrawal.createdAt), "d MMM yyyy, HH:mm:ss")} />
              {withdrawal.approvedAt && (
                <Row
                  label={withdrawal.status === "REJECTED" ? t.withdrawals.viewDialog.reviewed : t.withdrawals.viewDialog.approved}
                  value={format(new Date(withdrawal.approvedAt), "d MMM yyyy, HH:mm:ss")}
                />
              )}
              {withdrawal.status === "REJECTED" && withdrawal.rejectionReason && (
                <Row label={t.withdrawals.viewDialog.rejectionReason} value={withdrawal.rejectionReason} />
              )}
            </div>

            <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">
              {t.withdrawals.viewDialog.withdrawalAccountHeading}
            </p>
            <div className="flex flex-col">
              <Row label={t.withdrawals.viewDialog.paymentMethod} value={withdrawal.accountType} />
              {withdrawal.bankName && <Row label={t.withdrawals.viewDialog.bankName} value={withdrawal.bankName} />}
              <Row label={t.withdrawals.viewDialog.accountName} value={withdrawal.accountName} />
              <Row label={t.withdrawals.viewDialog.accountNumber} value={withdrawal.accountNumber} />
            </div>

            {(withdrawal.transferAccountType || withdrawal.transferAccountName || withdrawal.transferAccountNumber) && (
              <>
                <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">{t.withdrawals.viewDialog.transferAccountHeading}</p>
                <div className="flex flex-col">
                  <Row label={t.withdrawals.viewDialog.paymentMethod} value={withdrawal.transferAccountType || "—"} />
                  {withdrawal.transferAccountSubname && (
                    <Row label={t.withdrawals.viewDialog.subname} value={withdrawal.transferAccountSubname} />
                  )}
                  <Row label={t.withdrawals.viewDialog.accountName} value={withdrawal.transferAccountName || "—"} />
                  <Row label={t.withdrawals.viewDialog.accountNumber} value={withdrawal.transferAccountNumber || "—"} />
                  <Row label={t.withdrawals.viewDialog.transactionCode} value={withdrawal.transferTransactionCode || "—"} />
                  <Row
                    label={t.withdrawals.viewDialog.transactionDateTime}
                    value={
                      withdrawal.transferTransactionTime
                        ? `${format(new Date(withdrawal.approvedAt ?? withdrawal.createdAt), "d MMM yyyy")}, ${withdrawal.transferTransactionTime}`
                        : "—"
                    }
                  />
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
