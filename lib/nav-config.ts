import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Gauge,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CreditCard,
  Clock,
  Film,
  Fingerprint,
  FolderInput,
  Landmark,
  LayoutDashboard,
  ListVideo,
  MessageSquare,
  MessageSquareWarning,
  Radio,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tv,
  UserCog,
  Users,
  Wallet,
  Waypoints,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { TranslationShape } from "@/lib/i18n/translations";

/** Every nav item's label is a key into `t.nav`, resolved at render time so the sidebar/navbar can react to the active language. */
export type NavLabelKey = keyof TranslationShape["nav"];

export interface NavItem {
  labelKey: NavLabelKey;
  href: string;
  icon: LucideIcon;
  /**
   * The single permission that makes this entry visible — always the same
   * permission the destination page's `RequirePermission` gate asks for, so
   * the sidebar can never offer a link that lands on "no access".
   *
   * Parent groups carry no permission of their own: a group is visible when
   * any of its children is (see `filterNavByPermission`), which is what the
   * old hand-maintained "parent roles = union of children's roles" comments
   * were approximating.
   */
  permission?: Permission;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "DASHBOARD.VIEW",
  },
  {
    labelKey: "movies",
    href: "/movies",
    icon: Film,
    children: [
      {
        labelKey: "allMovies",
        href: "/movies",
        icon: Film,
        permission: "MOVIES.VIEW",
      },
      {
        // The bulk folder-drop ingest flow — it creates movies, so it is
        // gated on MOVIES.CREATE rather than on being able to view them.
        labelKey: "uploadMovie",
        href: "/movies/upload-external",
        icon: FolderInput,
        permission: "MOVIES.CREATE",
      },
      {
        // A publish queue: the only thing it adds over /movies is the
        // publish action, so MOVIES.PUBLISH is what makes it worth showing.
        labelKey: "readyToPublish",
        href: "/movies/ready-to-publish",
        icon: Rocket,
        permission: "MOVIES.PUBLISH",
      },
      {
        labelKey: "categories",
        href: "/movies/categories",
        icon: ListVideo,
        permission: "CATEGORIES.VIEW",
      },
    ],
  },
  {
    labelKey: "series",
    href: "/series",
    icon: Tv,
    children: [
      {
        // Everything series-related (details, seasons, episode uploads)
        // lives on each show's own manage page — no separate upload page.
        labelKey: "allSeries",
        href: "/series",
        icon: Tv,
        permission: "SERIES.VIEW",
      },
      {
        labelKey: "seriesReadyToPublish",
        href: "/series/ready-to-publish",
        icon: Rocket,
        permission: "SERIES.PUBLISH",
      },
    ],
  },
  {
    labelKey: "people",
    href: "/users",
    icon: Users,
    children: [
      {
        labelKey: "users",
        href: "/users",
        icon: Users,
        permission: "USERS.VIEW",
      },
      {
        // The relationship graph is built from the same admin user reads.
        labelKey: "userRelationships",
        href: "/users/relationships",
        icon: Waypoints,
        permission: "USERS.VIEW",
      },
      {
        labelKey: "peakUsers",
        href: "/users/peak-users",
        icon: Gauge,
        permission: "PEAK_USERS.VIEW",
      },
      {
        labelKey: "staff",
        href: "/staff",
        icon: UserCog,
        permission: "STAFF.VIEW",
      },
    ],
  },
  {
    // Behavioural data about identifiable users — deliberately its own
    // section rather than tabs under People, because "who is this account"
    // and "what is everyone doing right now" are different jobs.
    //
    // Every child asks for TRACKING.VIEW and nothing more: the section is
    // read-or-not, and the three sharper permissions (COMMENTS_MODERATE,
    // FEEDBACK_MANAGE, PII_VIEW) change what a page LETS YOU DO or SHOWS
    // once you are on it. Gating a link on one of them would hide a page a
    // read-only reviewer is entitled to see.
    labelKey: "tracking",
    // A group's href is a real destination, not a namespace: when the
    // sidebar is collapsed the group icon renders as a Link to it (see
    // Sidebar's collapsed-group branch). So it points at the first child,
    // exactly as People points at /users and Finance at /finance — there is
    // no /tracking page and there does not need to be one.
    href: "/tracking/comments",
    icon: Activity,
    children: [
      {
        labelKey: "trackingComments",
        href: "/tracking/comments",
        icon: MessageSquare,
        permission: "TRACKING.VIEW",
      },
      {
        labelKey: "trackingFeedback",
        href: "/tracking/feedback",
        icon: MessageSquareWarning,
        permission: "TRACKING.VIEW",
      },
      {
        labelKey: "trackingActiveUsers",
        href: "/tracking/active-users",
        icon: Radio,
        permission: "TRACKING.VIEW",
      },
      {
        // WHEN people watch — hours and weekdays, not which titles.
        labelKey: "trackingWatchTime",
        href: "/tracking/watch-time",
        icon: Clock,
        permission: "TRACKING.VIEW",
      },
      {
        // What people TYPE into the search box, not what they watched.
        labelKey: "trackingSearches",
        href: "/tracking/searches",
        icon: Search,
        permission: "TRACKING.VIEW",
      },
      {
        labelKey: "trackingPhoneIp",
        href: "/tracking/phone-ip",
        icon: Fingerprint,
        permission: "TRACKING.VIEW",
      },
    ],
  },
  {
    labelKey: "finance",
    href: "/finance",
    icon: Wallet,
    children: [
      {
        labelKey: "overview",
        href: "/finance",
        icon: Wallet,
        permission: "FINANCE.VIEW",
      },
      {
        // "Payment Methods" is the customer-facing method catalogue —
        // PAYMENT_METHODS.*, distinct from the internal ledger below.
        labelKey: "paymentMethods",
        href: "/payment-accounts",
        icon: Landmark,
        permission: "PAYMENT_METHODS.VIEW",
      },
      {
        labelKey: "paymentAccounts",
        href: "/finance/payment-accounts",
        icon: Banknote,
        permission: "PAYMENT_ACCOUNTS.VIEW",
      },
      {
        labelKey: "deposits",
        href: "/deposits",
        icon: ArrowDownToLine,
        permission: "DEPOSITS.VIEW",
      },
      {
        labelKey: "withdrawals",
        href: "/withdrawals",
        icon: ArrowUpFromLine,
        permission: "WITHDRAWALS.VIEW",
      },
      {
        // The limits screen is a pure editor for the finance settings —
        // there is nothing to read on it without the manage permission.
        labelKey: "limits",
        href: "/finance/limits",
        icon: SlidersHorizontal,
        permission: "FINANCE.SETTINGS_MANAGE",
      },
    ],
  },
  {
    labelKey: "subscriptions",
    href: "/subscriptions",
    icon: CreditCard,
    permission: "SUBSCRIPTIONS.VIEW",
  },
  {
    labelKey: "roles",
    href: "/roles",
    icon: ShieldCheck,
    permission: "ROLES.VIEW",
  },
  {
    labelKey: "settings",
    href: "/settings",
    icon: Settings,
    permission: "SETTINGS.VIEW",
  },
];

/**
 * Keeps only the entries the caller can actually reach. A leaf survives when
 * it declares a permission the caller holds; a group survives when at least
 * one of its children survived — so a group never renders as an empty
 * expandable shell, and a group never has to restate its children's rules.
 */
export function filterNavByPermission(
  items: NavItem[],
  can: (permission: Permission) => boolean,
): NavItem[] {
  return items.flatMap((item) => {
    if (item.children) {
      const children = filterNavByPermission(item.children, can);
      return children.length > 0 ? [{ ...item, children }] : [];
    }
    return item.permission && can(item.permission) ? [item] : [];
  });
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
