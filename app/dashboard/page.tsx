"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { useLanguage } from "@/lib/context/language-context";

export default function DashboardPage() {
  const { t } = useLanguage();

  return (
    <RequirePermission
      permission="DASHBOARD.VIEW"
      title={t.dashboard.title}
      description={t.dashboard.description}
    >
      <div>
        <PageHeader title={t.dashboard.title} description={t.dashboard.description} />
        <AdminDashboard />
      </div>
    </RequirePermission>
  );
}
