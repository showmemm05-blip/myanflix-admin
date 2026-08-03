"use client";

import { useCallback, useEffect, useState } from "react";
import { useRole } from "@/lib/context/role-context";
import { getSocket } from "@/lib/socket";
import { depositService } from "@/services/api/depositService";
import type { Deposit } from "@/types/deposit";

const MAX_ITEMS = 8;

interface DepositCreatedEvent {
  id: string;
  userId: string;
  username: string;
  amount: number;
  paymentMethod: string;
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
  const { isAdminOrAbove } = useRole();
  const [items, setItems] = useState<Deposit[]>([]);

  const refresh = useCallback(() => {
    if (!isAdminOrAbove) return;
    depositService
      .getAll({ status: "PENDING", limit: MAX_ITEMS })
      .then((res) => setItems(res.items))
      .catch(() => {});
  }, [isAdminOrAbove]);

  useEffect(() => {
    if (!isAdminOrAbove) {
      setItems([]);
      return;
    }

    refresh();

    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: DepositCreatedEvent) => {
      setItems((prev) =>
        [
          {
            id: event.id,
            userId: event.userId,
            userName: event.username,
            userEmail: "",
            amount: event.amount,
            paymentMethod: event.paymentMethod,
            reference: event.reference,
            status: "PENDING" as const,
            rejectionReason: null,
            approvedByUserId: null,
            approvedAt: null,
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
    // refresh() intentionally excluded — it's stable per isAdminOrAbove and re-running it here would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrAbove]);

  return { items, count: items.length, refresh };
}
