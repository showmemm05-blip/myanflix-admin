"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireRole } from "@/components/shared/RequireRole";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";

export default function DashboardPage() {
  const { role, currentUser } = useRole();
  const { t } = useLanguage();

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN", "USER"]}
      title={t.dashboard.title}
      description={t.dashboard.description}
    >
      <div>
        <PageHeader
          title={role === "USER" ? t.dashboard.myAccount : t.dashboard.title}
          description={
            role === "USER"
              ? t.dashboard.welcomeBack(currentUser.name.split(" ")[0])
              : t.dashboard.description
          }
        />
        {role === "USER" ? <UserDashboard /> : <AdminDashboard role={role} />}
      </div>
    </RequireRole>
  );
}
