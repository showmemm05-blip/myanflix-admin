"use client";

import type { ReactNode } from "react";
import { useRole } from "@/lib/context/role-context";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccessRestricted } from "@/components/shared/AccessRestricted";
import type { UserRole } from "@/types/user";

interface RequireRoleProps {
  allow: UserRole[];
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * A single, positive allow-list gate for a whole page — reused instead of
 * each page independently re-deriving its own exclusion check, which has
 * already drifted wrong twice (Users/Deposits pages used to exclude only
 * "USER", silently letting every other role through regardless of what the
 * backend actually permits them).
 */
export function RequireRole({ allow, title, description, children }: RequireRoleProps) {
  const { role } = useRole();
  if (!allow.includes(role)) {
    return (
      <div>
        <PageHeader title={title} description={description} />
        <AccessRestricted role={role} />
      </div>
    );
  }
  return <>{children}</>;
}
