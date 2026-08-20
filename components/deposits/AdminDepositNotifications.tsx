"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket } from "@/lib/socket";
import { formatKyat } from "@/lib/currency";
import { userLabel } from "@/lib/user-label";

interface DepositCreatedEvent {
  id: string;
  userId: string;
  /** Raw login identity, straight off the realtime payload. */
  username: string;
  /** The name the user set; null until they set one. Render via `userLabel(event)`. */
  displayName: string | null;
  amount: number;
  paymentMethod: string;
  reference: string;
  status: string;
  createdAt: string;
}

/**
 * Mounted once at the app root so a new deposit request surfaces a toast no
 * matter which page the admin is currently on — the Deposits page's own
 * listener (components/deposits/page.tsx) only prepends to its local table
 * state and deliberately doesn't toast, to avoid a duplicate notification
 * when an admin happens to already be on that page.
 */
export function AdminDepositNotifications() {
  const { can } = useRole();
  // The toast mirrors the deposits queue, so it follows the same permission.
  const canReviewDeposits = can("DEPOSITS.VIEW");
  const { t } = useLanguage();

  useEffect(() => {
    if (!canReviewDeposits) return;
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: DepositCreatedEvent) => {
      toast.info(t.deposits.notifications.newRequestTitle, {
        description: t.deposits.notifications.newRequestDescription(
          userLabel(event),
          formatKyat(event.amount),
          event.paymentMethod,
        ),
      });
    };

    socket.on("deposit.created", handleCreated);
    return () => {
      socket.off("deposit.created", handleCreated);
    };
  }, [canReviewDeposits, t]);

  return null;
}
