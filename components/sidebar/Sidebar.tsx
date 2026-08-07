"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  LogOut,
} from "lucide-react";
import { filterNavByRole, navItems, type NavItem } from "@/lib/nav-config";
import { useRole } from "@/lib/context/role-context";
import { useSidebar } from "@/lib/context/sidebar-context";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function isChildActive(pathname: string, href: string) {
  return pathname === href;
}

function isParentActive(pathname: string, item: NavItem) {
  if (item.children) return pathname.startsWith(item.href);
  return pathname === item.href;
}

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, currentUser, logout } = useRole();
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  const isCollapsed = !mobile && collapsed;
  const items = filterNavByRole(navItems, role);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ Movies: true });

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleNavClick = () => {
    if (mobile) setMobileOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-4",
          isCollapsed ? "justify-center px-2" : "justify-between"
        )}
      >
        <Link
          href="/dashboard"
          onClick={handleNavClick}
          className="flex items-center gap-2 overflow-hidden"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground glow-primary">
            <Clapperboard className="size-4.5" />
          </div>
          {!isCollapsed && (
            <span className="truncate text-lg font-bold tracking-tight text-gradient-brand">
              MyanFlix
            </span>
          )}
        </Link>
        {!mobile && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="size-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isParentActive(pathname, item);
            const Icon = item.icon;

            if (item.children && item.children.length > 0 && !isCollapsed) {
              const open = openMenus[item.label] ?? true;
              return (
                <li key={item.label}>
                  <Collapsible
                    open={open}
                    onOpenChange={(next) =>
                      setOpenMenus((prev) => ({ ...prev, [item.label]: next }))
                    }
                  >
                    <CollapsibleTrigger
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4.5 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-4">
                        {item.children.map((child) => {
                          const childActive = isChildActive(pathname, child.href);
                          const ChildIcon = child.icon;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={handleNavClick}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                                  childActive
                                    ? "bg-primary/15 text-primary font-medium"
                                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-foreground"
                                )}
                              >
                                <ChildIcon className="size-3.5 shrink-0" />
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              );
            }

            if (item.children && item.children.length > 0 && isCollapsed) {
              const iconLink = (
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center justify-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" />
                </Link>
              );
              return (
                <li key={item.label}>
                  <Popover>
                    <PopoverTrigger render={iconLink} openOnHover delay={100} closeDelay={150} />
                    <PopoverContent side="right" align="start" sideOffset={8} className="w-48 p-1.5">
                      <p className="truncate px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {item.label}
                      </p>
                      <ul className="flex flex-col gap-0.5">
                        {item.children.map((child) => {
                          const childActive = isChildActive(pathname, child.href);
                          const ChildIcon = child.icon;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={handleNavClick}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                                  childActive
                                    ? "bg-primary/15 text-primary font-medium"
                                    : "text-popover-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                                )}
                              >
                                <ChildIcon className="size-4 shrink-0" />
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </li>
              );
            }

            const linkContent = (
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isCollapsed && "justify-center px-2",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <Icon className="size-4.5 shrink-0" />
                {!isCollapsed && item.label}
              </Link>
            );

            return (
              <li key={item.href}>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger render={linkContent} />
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {!mobile && (
        <div className="flex justify-center border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronsRight className={cn("size-4 transition-transform", !isCollapsed && "rotate-180")} />
          </Button>
        </div>
      )}

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent",
                  isCollapsed && "justify-center"
                )}
              />
            }
          >
            <Avatar className="size-8 shrink-0 border border-sidebar-border">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {currentUser.name}
                </p>
                <RoleBadge role={role} className="mt-0.5 h-5 px-1.5 text-[10px]" />
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{currentUser.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
