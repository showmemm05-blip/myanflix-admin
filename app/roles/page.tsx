"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { AccessRestricted } from "@/components/shared/AccessRestricted";
import { ErrorState } from "@/components/shared/ErrorState";
import { RoleCard } from "@/components/roles/RoleCard";
import { PermissionMatrix } from "@/components/roles/PermissionMatrix";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/lib/context/role-context";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { rolesService } from "@/services/api/rolesService";
import { userService } from "@/services/api/userService";
import type { RoleDefinition } from "@/types/role";

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "SUPER_ADMIN",
    title: "Super Admin",
    description: "Full platform control — manage admins, users, movies, revenue and permissions.",
    color: "oklch(0.577 0.226 27.3)",
    capabilities: [
      "Manage admins",
      "Manage users",
      "Manage movies",
      "View all revenue",
      "View system analytics",
    ],
  },
  {
    role: "ADMIN",
    title: "Admin",
    description: "Content-focused access to upload, edit, and moderate the movie catalog.",
    color: "oklch(0.65 0.18 45)",
    capabilities: ["Upload movies", "Edit movies", "Delete movies", "Manage video uploads"],
  },
  {
    role: "USER",
    title: "User",
    description: "Standard subscriber access to purchased content and personal account data.",
    color: "oklch(0.6 0.12 200)",
    capabilities: [
      "View purchased movies",
      "View watch history",
      "View account balance",
      "View own transaction history",
    ],
  },
];

export default function RolesPage() {
  const { role } = useRole();

  const { data, isLoading, error, refetch } = useAsyncData(async () => {
    const [matrix, users] = await Promise.all([
      rolesService.getRolePermissionMatrix(),
      userService.getUsers({ limit: 100 }),
    ]);
    const userCountByRole: Record<string, number> = {};
    for (const user of users.items) {
      userCountByRole[user.role] = (userCountByRole[user.role] ?? 0) + 1;
    }
    return { matrix, userCountByRole };
  }, []);

  if (role !== "SUPER_ADMIN") {
    return (
      <div>
        <PageHeader title="Roles & Permissions" description="Manage platform-wide access control." />
        <AccessRestricted role={role} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Manage platform-wide access control." />

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : error || !data ? (
        <ErrorState description="We couldn't load role data." onRetry={refetch} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {ROLE_DEFINITIONS.map((r) => (
              <RoleCard key={r.role} role={r} userCount={data.userCountByRole[r.role] ?? 0} />
            ))}
          </div>

          <PermissionMatrix matrix={data.matrix} />
        </>
      )}
    </div>
  );
}
