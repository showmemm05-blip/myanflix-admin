"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";

const STATUS_TONE: Record<WithdrawalStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {withdrawal && (
          <>
            <DialogHeader>
              <DialogTitle>Withdrawal request</DialogTitle>
              <DialogDescription>Full details for this payout request.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col">
              <Row label="User" value={withdrawal.userName} />
              <Row label="Phone" value={formatLocalPhone(withdrawal.userPhone) || "—"} />
              <Row label="Amount" value={formatKyat(withdrawal.amount)} />
              <Row
                label="Status"
                value={<StatusBadge label={withdrawal.status} tone={STATUS_TONE[withdrawal.status]} />}
              />
              <Row label="Requested" value={format(new Date(withdrawal.createdAt), "MMM d, yyyy HH:mm")} />
              {withdrawal.approvedAt && (
                <Row
                  label={withdrawal.status === "REJECTED" ? "Reviewed" : "Approved"}
                  value={format(new Date(withdrawal.approvedAt), "MMM d, yyyy HH:mm")}
                />
              )}
              {withdrawal.status === "REJECTED" && withdrawal.rejectionReason && (
                <Row label="Rejection reason" value={withdrawal.rejectionReason} />
              )}
            </div>

            <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">
              User&apos;s withdrawal account
            </p>
            <div className="flex flex-col">
              <Row label="Payment method" value={withdrawal.accountType} />
              <Row label="Account name" value={withdrawal.accountName} />
              <Row label="Account / phone number" value={withdrawal.accountNumber} />
            </div>

            {(withdrawal.transferAccountType || withdrawal.transferAccountName || withdrawal.transferAccountNumber) && (
              <>
                <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">Our transfer account</p>
                <div className="flex flex-col">
                  <Row label="Payment method" value={withdrawal.transferAccountType || "—"} />
                  <Row label="Account name" value={withdrawal.transferAccountName || "—"} />
                  <Row label="Account / phone number" value={withdrawal.transferAccountNumber || "—"} />
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
