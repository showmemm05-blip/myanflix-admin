"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireRole } from "@/components/shared/RequireRole";
import { ErrorState } from "@/components/shared/ErrorState";
import { RoleCard } from "@/components/roles/RoleCard";
import { PermissionMatrix } from "@/components/roles/PermissionMatrix";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { rolesService } from "@/services/api/rolesService";
import { userService } from "@/services/api/userService";
import type { RoleDefinition } from "@/types/role";
import { useLanguage } from "@/lib/context/language-context";

export default function RolesPage() {
  const { t } = useLanguage();
  const ROLE_DEFINITIONS: RoleDefinition[] = [
    {
      role: "SUPER_ADMIN",
      title: t.roles.definitions.superAdmin.title,
      description: t.roles.definitions.superAdmin.description,
      color: "var(--primary)",
      capabilities: t.roles.definitions.superAdmin.capabilities,
    },
    {
      role: "ADMIN",
      title: t.roles.definitions.admin.title,
      description: t.roles.definitions.admin.description,
      color: "var(--chart-5)",
      capabilities: t.roles.definitions.admin.capabilities,
    },
    {
      role: "USER",
      title: t.roles.definitions.user.title,
      description: t.roles.definitions.user.description,
      color: "var(--muted-foreground)",
      capabilities: t.roles.definitions.user.capabilities,
    },
    {
      role: "CONTENT_UPLOADER",
      title: t.roles.definitions.contentUploader.title,
      description: t.roles.definitions.contentUploader.description,
      color: "var(--chart-2)",
      capabilities: t.roles.definitions.contentUploader.capabilities,
    },
  ];

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

  return (
    <RequireRole
      allow={["SUPER_ADMIN"]}
      title={t.roles.page.title}
      description={t.roles.page.description}
    >
      <div>
        <PageHeader title={t.roles.page.title} description={t.roles.page.description} />

        {isLoading ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-lg" />
          </div>
        ) : error || !data ? (
          <ErrorState description={t.roles.loadError} onRetry={refetch} />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
              {ROLE_DEFINITIONS.map((r) => (
                <RoleCard key={r.role} role={r} userCount={data.userCountByRole[r.role] ?? 0} />
              ))}
            </div>

            <PermissionMatrix matrix={data.matrix} />
          </>
        )}
      </div>
    </RequireRole>
  );
}
