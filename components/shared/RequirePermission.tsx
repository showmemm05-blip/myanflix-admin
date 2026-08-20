"use client";

import type { ReactNode } from "react";
import { useRole } from "@/lib/context/role-context";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccessRestricted } from "@/components/shared/AccessRestricted";
import type { Permission } from "@/lib/permissions";

interface RequirePermissionProps {
  /**
   * The permission this page needs. An array is an ANY-of check, used where
   * one screen legitimately serves two capabilities (the payment-account
   * ledger reads under either PAYMENT_ACCOUNTS.VIEW or LEDGER_MANAGE).
   */
  permission: Permission | Permission[];
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * The single page-level gate for the whole admin — the permission-driven
 * replacement for the old `RequireRole` allow-list, which had to be kept in
 * sync with role names by hand and drifted wrong twice.
 *
 * This is a UX gate only: it decides whether to render the page or the
 * "no access" panel. Every request the page makes is independently gated by
 * `PermissionsGuard` on the backend, which is the real boundary.
 */
export function RequirePermission({
  permission,
  title,
  description,
  children,
}: RequirePermissionProps) {
  const { role, can, canAny } = useRole();
  const allowed = Array.isArray(permission) ? canAny(permission) : can(permission);

  if (!allowed) {
    return (
      <div>
        <PageHeader title={title} description={description} />
        <AccessRestricted role={role} />
      </div>
    );
  }
  return <>{children}</>;
}
