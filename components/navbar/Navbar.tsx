"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, Menu, Search, Settings, UserRound } from "lucide-react";
import { getPageTitle } from "@/lib/nav-config";
import { useRole } from "@/lib/context/role-context";
import { useSidebar } from "@/lib/context/sidebar-context";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatKyat } from "@/lib/currency";
import { toast } from "sonner";

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, role } = useRole();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { items: notifications, count: notificationCount, refresh: refreshNotifications } = useAdminNotifications();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="max-w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="truncate text-base font-semibold sm:text-lg">
          {getPageTitle(pathname)}
        </h1>
        <RoleBadge role={role} className="hidden sm:inline-flex" />
      </div>

      <div className="relative hidden w-full max-w-xs lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search movies, users, transactions..."
          className="bg-secondary/50 pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") toast.info("Global search isn't wired up yet.");
          }}
        />
      </div>

      <DropdownMenu onOpenChange={(open) => open && refreshNotifications()}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
        >
          <Bell className="size-5" />
          {notificationCount > 0 && (
            <span className="absolute right-2 top-2 flex size-2 rounded-full bg-primary" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Deposits awaiting review</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nothing pending right now.</p>
            ) : (
              notifications.map((deposit) => (
                <DropdownMenuItem
                  key={deposit.id}
                  className="flex-col items-start gap-0.5 py-2"
                  render={<Link href="/deposits" />}
                >
                  <span className="text-sm font-medium">
                    {deposit.userName} &middot; {formatKyat(deposit.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">via {deposit.paymentMethod}</span>
                  <span className="text-[11px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(deposit.createdAt), { addSuffix: true })}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="rounded-full ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          }
        >
          <Avatar className="size-8 border border-border">
            <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
            <AvatarFallback>{currentUser.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{currentUser.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={`/users/${currentUser.id}`} />}>
              <UserRound className="size-4" />
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
