"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Menu, Search, Settings, UserRound } from "lucide-react";
import { getPageTitle } from "@/lib/nav-config";
import { useRole } from "@/lib/context/role-context";
import { useSidebar } from "@/lib/context/sidebar-context";
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
import { toast } from "sonner";

const NOTIFICATIONS = [
  {
    id: "n1",
    title: "New movie processing complete",
    detail: "“Twilight of the Wolves” finished transcoding.",
    time: "12m ago",
  },
  {
    id: "n2",
    title: "Payout threshold reached",
    detail: "Monthly revenue crossed 175K Ks.",
    time: "2h ago",
  },
  {
    id: "n3",
    title: "New admin invited",
    detail: "Kyaw Zin Htet accepted the admin invite.",
    time: "1d ago",
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, role } = useRole();
  const { mobileOpen, setMobileOpen } = useSidebar();

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

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
        >
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 flex size-2 rounded-full bg-primary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {NOTIFICATIONS.map((n) => (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2">
                <span className="text-sm font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.detail}</span>
                <span className="text-[11px] text-muted-foreground/70">{n.time}</span>
              </DropdownMenuItem>
            ))}
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
