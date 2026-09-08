"use client";

import { useCallback, useEffect, useState } from "react";
import { useRole } from "@/lib/context/role-context";
import { getSocket } from "@/lib/socket";
import { depositService } from "@/services/api/depositService";
import { userLabel } from "@/lib/user-label";
import type { Deposit } from "@/types/deposit";

const MAX_ITEMS = 8;

/** Stable empty reference so consumers' memo/effect deps do not churn. */
const EMPTY_ITEMS: Deposit[] = [];

interface DepositCreatedEvent {
  id: string;
  userId: string;
  /** Raw login identity, straight off the realtime payload. */
  username: string;
  /** The name the user set; null until they set one. Render via `userLabel(event)`. */
  displayName: string | null;
  phone: string | null;
  email: string | null;
  amount: number;
  paymentMethod: string;
  accountName: string | null;
  reference: string;
  status: string;
  createdAt: string;
}

/**
 * The admin bell's real data source: deposits still awaiting review. Seeded
 * from the API on mount, then grows live via the same `deposit.created`
 * socket event AdminDepositNotifications already toasts from — this just
 * also keeps a persistent list instead of a toast-then-gone one.
 *
 * There's no live "remove" signal: approve/reject only notify the
 * depositing user's own socket room (see RealtimeGateway), never the shared
 * admins room — so a deposit another admin just resolved can briefly linger
 * here. `refresh()` re-syncs against the API; call it when the dropdown
 * opens rather than polling.
 */
export function useAdminNotifications() {
  const { can } = useRole();
  // The bell lists pending deposits — the same read the Deposits page makes.
  const canReviewDeposits = can("DEPOSITS.VIEW");
  const [items, setItems] = useState<Deposit[]>([]);

  const refresh = useCallback(() => {
    if (!canReviewDeposits) return;
    depositService
      .getAll({ status: "PENDING", limit: MAX_ITEMS })
      .then((res) => setItems(res.items))
      .catch(() => {});
  }, [canReviewDeposits]);

  useEffect(() => {
    if (!canReviewDeposits) return;

    refresh();

    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: DepositCreatedEvent) => {
      setItems((prev) =>
        [
          {
            id: event.id,
            userId: event.userId,
            userName: userLabel(event),
            userUsername: event.username,
            userPhone: event.phone ?? null,
            userEmail: event.email ?? null,
            amount: event.amount,
            paymentMethod: event.paymentMethod,
            accountName: event.accountName,
            reference: event.reference,
            status: "PENDING" as const,
            rejectionReason: null,
            approvedByUserId: null,
            approvedAt: null,
            receivingAccountType: null,
            receivingAccountSubname: null,
            receivingAccountName: null,
            receivingAccountNumber: null,
            receivingTransactionCode: null,
            receivingTransactionTime: null,
            receivingPaymentAccountId: null,
            walletBalanceBefore: null,
            walletBalanceAfter: null,
            createdAt: event.createdAt,
            updatedAt: event.createdAt,
          },
          ...prev.filter((d) => d.id !== event.id),
        ].slice(0, MAX_ITEMS),
      );
    };

    socket.on("deposit.created", handleCreated);
    return () => {
      socket.off("deposit.created", handleCreated);
    };
    // refresh() intentionally excluded — it's stable per canReviewDeposits and re-running it here would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReviewDeposits]);

  // Filtered on read rather than cleared in the effect: if the permission is
  // revoked mid-session the bell empties immediately, without a second render
  // pass just to zero the list out.
  const visible = canReviewDeposits ? items : EMPTY_ITEMS;
  return { items: visible, count: visible.length, refresh };
}
