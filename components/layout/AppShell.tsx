"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSidebar } from "@/lib/context/sidebar-context";
import { useRole } from "@/lib/context/role-context";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Navbar } from "@/components/navbar/Navbar";
import { cn } from "@/lib/utils";

const PUBLIC_ROUTES = new Set(["/login"]);

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const { isAuthenticated, isLoading } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicRoute) router.replace("/login");
    if (isAuthenticated && isPublicRoute) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, isPublicRoute, router]);

  // Login page renders its own full-screen layout with no sidebar/navbar chrome.
  if (isPublicRoute) return <>{children}</>;

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
