"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { useRole } from "@/lib/context/role-context";

export default function DashboardPage() {
  const { role, currentUser } = useRole();

  return (
    <div>
      <PageHeader
        title={role === "USER" ? "My Account" : "Dashboard"}
        description={
          role === "USER"
            ? `Welcome back, ${currentUser.name.split(" ")[0]}.`
            : "Platform overview and performance analytics."
        }
      />
      {role === "USER" ? <UserDashboard /> : <AdminDashboard role={role} />}
    </div>
  );
}
