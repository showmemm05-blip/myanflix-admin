"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useRole } from "@/lib/context/role-context";
import { getSocket } from "@/lib/socket";
import { formatKyat } from "@/lib/currency";

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
 * Mounted once at the app root so a new deposit request surfaces a toast no
 * matter which page the admin is currently on — the Deposits page's own
 * listener (components/deposits/page.tsx) only prepends to its local table
 * state and deliberately doesn't toast, to avoid a duplicate notification
 * when an admin happens to already be on that page.
 */
export function AdminDepositNotifications() {
  const { isAdminOrAbove } = useRole();

  useEffect(() => {
    if (!isAdminOrAbove) return;
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: DepositCreatedEvent) => {
      toast.info("New deposit request", {
        description: `${event.username} submitted ${formatKyat(event.amount)} via ${event.paymentMethod}.`,
      });
    };

    socket.on("deposit.created", handleCreated);
    return () => {
      socket.off("deposit.created", handleCreated);
    };
  }, [isAdminOrAbove]);

  return null;
}
