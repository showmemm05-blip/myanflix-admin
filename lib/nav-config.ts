import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Film,
  FolderInput,
  Landmark,
  LayoutDashboard,
  ListVideo,
  Rocket,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tv,
  UserCog,
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
    roles: ["SUPER_ADMIN", "ADMIN", "USER", "CONTENT_UPLOADER"],
    children: [
      {
        label: "All Movies",
        href: "/movies",
        icon: Film,
        roles: ["SUPER_ADMIN", "ADMIN", "USER", "CONTENT_UPLOADER"],
      },
      {
        label: "Upload Movie",
        href: "/movies/upload-external",
        icon: FolderInput,
        roles: ["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"],
      },
      {
        label: "Ready to Publish",
        href: "/movies/ready-to-publish",
        icon: Rocket,
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
    label: "Series",
    href: "/series",
    icon: Tv,
    roles: ["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"],
    children: [
      {
        // Everything series-related (details, seasons, episode uploads)
        // lives on each show's own manage page — no separate upload page.
        label: "All Series",
        href: "/series",
        icon: Tv,
        roles: ["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"],
      },
      {
        label: "Ready to Publish",
        href: "/series/ready-to-publish",
        icon: Rocket,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
  {
    label: "People",
    href: "/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        // Backend gates user management behind USER_MANAGE, granted to SUPER_ADMIN only.
        label: "Users",
        href: "/users",
        icon: Users,
        roles: ["SUPER_ADMIN"],
      },
      {
        // Backend gates staff management behind STAFF_MANAGE, granted to Super Admin only.
        label: "Staff",
        href: "/staff",
        icon: UserCog,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
  {
    // Parent roles are the union of its children's roles, so a plain USER
    // still sees "Finance" (for Overview) even though Payment Methods/
    // Deposits/Withdrawals get filtered out of the expanded submenu for them.
    label: "Finance",
    href: "/finance",
    icon: Wallet,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
    children: [
      {
        label: "Overview",
        href: "/finance",
        icon: Wallet,
        roles: ["SUPER_ADMIN", "ADMIN", "USER"],
      },
      {
        // Backend gates payment account management behind PAYMENT_ACCOUNT_MANAGE, granted to Super Admin only.
        label: "Payment Methods",
        href: "/payment-accounts",
        icon: Landmark,
        roles: ["SUPER_ADMIN"],
      },
      {
        // Backend gates deposit review behind DEPOSIT_MANAGE, granted to Admin/Super Admin only.
        label: "Deposits",
        href: "/deposits",
        icon: ArrowDownToLine,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        // Backend gates withdrawal review behind WITHDRAWAL_MANAGE, granted to Admin/Super Admin only.
        label: "Withdrawals",
        href: "/withdrawals",
        icon: ArrowUpFromLine,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        // Backend gates limit updates behind FINANCE_SETTINGS_MANAGE, granted to Super Admin only.
        label: "Limits",
        href: "/finance/limits",
        icon: SlidersHorizontal,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
  {
    // Backend gates plan create/edit behind SUBSCRIPTION_MANAGE, granted to Admin/Super Admin only.
    label: "Subscriptions",
    href: "/subscriptions",
    icon: CreditCard,
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
      children: item.children
        ? filterNavByRole(item.children, role)
        : undefined,
    }));
}

function flattenNav(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenNav(item.children) : []),
  ]);
}

export function getPageTitle(pathname: string): string {
  const flat = flattenNav(navItems).sort(
    (a, b) => b.href.length - a.href.length,
  );
  const match = flat.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (match) return match.label;
  const segment = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}
