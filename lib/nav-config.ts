import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  Film,
  LayoutDashboard,
  ListVideo,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@/types/user";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
  },
  {
    label: "Movies",
    href: "/movies",
    icon: Film,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
    children: [
      {
        label: "All Movies",
        href: "/movies",
        icon: Film,
        roles: ["SUPER_ADMIN", "ADMIN", "USER"],
      },
      {
        label: "Upload Movie",
        href: "/movies/upload",
        icon: Upload,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        label: "Categories",
        href: "/movies/categories",
        icon: ListVideo,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
  {
    // Backend gates user management behind USER_MANAGE, granted to SUPER_ADMIN only.
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Finance",
    href: "/finance",
    icon: Wallet,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
  },
  {
    // Backend gates deposit review behind DEPOSIT_MANAGE, granted to Admin/Super Admin only.
    label: "Deposits",
    href: "/deposits",
    icon: ArrowDownToLine,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Roles & Permissions",
    href: "/roles",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
  },
];

export function filterNavByRole(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: item.children ? filterNavByRole(item.children, role) : undefined,
    }));
}

function flattenNav(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNav(item.children) : [])]);
}

export function getPageTitle(pathname: string): string {
  const flat = flattenNav(navItems).sort((a, b) => b.href.length - a.href.length);
  const match = flat.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (match) return match.label;
  const segment = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}
