import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
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
  Waypoints,
} from "lucide-react";
import type { UserRole } from "@/types/user";
import type { TranslationShape } from "@/lib/i18n/translations";

/** Every nav item's label is a key into `t.nav`, resolved at render time so the sidebar/navbar can react to the active language. */
export type NavLabelKey = keyof TranslationShape["nav"];

export interface NavItem {
  labelKey: NavLabelKey;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
  },
  {
    labelKey: "movies",
    href: "/movies",
    icon: Film,
    roles: ["SUPER_ADMIN", "ADMIN", "USER", "CONTENT_UPLOADER"],
    children: [
      {
        labelKey: "allMovies",
        href: "/movies",
        icon: Film,
        roles: ["SUPER_ADMIN", "ADMIN", "USER", "CONTENT_UPLOADER"],
      },
      {
        labelKey: "uploadMovie",
        href: "/movies/upload-external",
        icon: FolderInput,
        roles: ["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"],
      },
      {
        labelKey: "readyToPublish",
        href: "/movies/ready-to-publish",
        icon: Rocket,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        labelKey: "categories",
        href: "/movies/categories",
        icon: ListVideo,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
  {
    labelKey: "series",
    href: "/series",
    icon: Tv,
    roles: ["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"],
    children: [
      {
        // Everything series-related (details, seasons, episode uploads)
        // lives on each show's own manage page — no separate upload page.
        labelKey: "allSeries",
        href: "/series",
        icon: Tv,
        roles: ["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"],
      },
      {
        labelKey: "seriesReadyToPublish",
        href: "/series/ready-to-publish",
        icon: Rocket,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
  {
    labelKey: "people",
    href: "/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        // Backend gates user management behind USER_MANAGE, granted to SUPER_ADMIN only.
        labelKey: "users",
        href: "/users",
        icon: Users,
        roles: ["SUPER_ADMIN"],
      },
      {
        // Same gate as Users — the relationship endpoint requires USER_MANAGE.
        labelKey: "userRelationships",
        href: "/users/relationships",
        icon: Waypoints,
        roles: ["SUPER_ADMIN"],
      },
      {
        // Backend gates staff management behind STAFF_MANAGE, granted to Super Admin only.
        labelKey: "staff",
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
    labelKey: "finance",
    href: "/finance",
    icon: Wallet,
    roles: ["SUPER_ADMIN", "ADMIN", "USER"],
    children: [
      {
        labelKey: "overview",
        href: "/finance",
        icon: Wallet,
        roles: ["SUPER_ADMIN", "ADMIN", "USER"],
      },
      {
        // Backend gates payment account management behind PAYMENT_ACCOUNT_MANAGE, granted to Super Admin only.
        labelKey: "paymentMethods",
        href: "/payment-accounts",
        icon: Landmark,
        roles: ["SUPER_ADMIN"],
      },
      {
        // Backend gates ledger management behind PAYMENT_ACCOUNT_MANAGE, granted to Super Admin only — same restriction as Payment Methods.
        labelKey: "paymentAccounts",
        href: "/finance/payment-accounts",
        icon: Banknote,
        roles: ["SUPER_ADMIN"],
      },
      {
        // Backend gates deposit review behind DEPOSIT_MANAGE, granted to Admin/Super Admin only.
        labelKey: "deposits",
        href: "/deposits",
        icon: ArrowDownToLine,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        // Backend gates withdrawal review behind WITHDRAWAL_MANAGE, granted to Admin/Super Admin only.
        labelKey: "withdrawals",
        href: "/withdrawals",
        icon: ArrowUpFromLine,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        // Backend gates limit updates behind FINANCE_SETTINGS_MANAGE, granted to Super Admin only.
        labelKey: "limits",
        href: "/finance/limits",
        icon: SlidersHorizontal,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
  {
    // Backend gates plan create/edit behind SUBSCRIPTION_MANAGE, granted to Admin/Super Admin only.
    labelKey: "subscriptions",
    href: "/subscriptions",
    icon: CreditCard,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    labelKey: "roles",
    href: "/roles",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
  },
  {
    labelKey: "settings",
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

export function getPageTitle(pathname: string, t: TranslationShape): string {
  const flat = flattenNav(navItems).sort(
    (a, b) => b.href.length - a.href.length,
  );
  const match = flat.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (match) return t.nav[match.labelKey];
  const segment = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}
