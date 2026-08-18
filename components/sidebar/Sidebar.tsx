"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsUpDown,
  Clapperboard,
  LogOut,
} from "lucide-react";
import { filterNavByRole, navItems, type NavItem } from "@/lib/nav-config";
import { useRole } from "@/lib/context/role-context";
import { useSidebar } from "@/lib/context/sidebar-context";
import { useLanguage } from "@/lib/context/language-context";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Geometry, measured from the rail's left edge.

   One axis rule generates the whole list: an 18px icon axis at x=22–40
   (centre 31) and a label axis at x=52. The brand mark and every top-level
   icon sit on the first; the wordmark and every top-level label on the second.

   The horizontal insets live on the rows, not on <nav>, so every <li> is
   full-bleed and the active marker can be pinned at x=0–3 — the same x for a
   leaf, a group parent, a child and a collapsed icon. Depth is never
   re-encoded in the marker, so navigating reads as a marker sliding down a
   ruler, and collapsing the rail does not move it sideways.
--------------------------------------------------------------------------- */

/**
 * Expanded row box: x = 10 → 244.
 *
 * The inset is padding on the full-bleed <li> (or on a wrapper around the
 * group trigger), never a margin on the row itself: an absolutely positioned
 * child is laid out against its container's *padding* box, so the marker still
 * reaches x=0 while `w-full` on the row resolves against the content box and
 * cannot overflow.
 */
const ROW_INSET = "pl-[10px] pr-3";
/** Collapsed row box: a 40x40 square at x = 16 → 56. */
const ROW_INSET_COLLAPSED = "px-4";

const EASE_SPATIAL = "ease-[cubic-bezier(0.32,0.72,0,1)]";
const EASE_COLOR = "ease-[cubic-bezier(0.2,0,0,1)]";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sidebar-ring)]";

/** Hover fill. Never a shadow: the rail is the bottom rung of the surface ladder. */
const HOVER_FILL =
  "hover:bg-[color-mix(in_oklab,var(--sidebar-accent)_55%,transparent)] hover:text-sidebar-accent-foreground active:bg-[color-mix(in_oklab,var(--sidebar-accent)_70%,transparent)]";

/** Active pill. 18% — at 13% it composites to the same lightness as the hover fill. */
const ACTIVE_FILL =
  "bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)_24%,transparent)] active:bg-[color-mix(in_oklab,var(--primary)_28%,transparent)]";

const ROW_BASE = cn(
  "group/row relative flex w-full items-center rounded-[var(--radius-md)]",
  "text-[0.8125rem] leading-[1.35] transition-colors duration-[120ms]",
  EASE_COLOR,
  FOCUS_RING,
);

/** Exact match — a child row stands for exactly one route. */
function isChildActive(pathname: string, href: string) {
  return pathname === href;
}

/**
 * Does this item, or any of its children, own the current route?
 *
 * The `children.some(...)` half is mandatory, not defensive: People's href is
 * `/users` but Staff is `/staff`; Finance's href is `/finance` but Deposits is
 * `/deposits`, Withdrawals `/withdrawals`, Payment Methods `/payment-accounts`.
 * A plain `startsWith(item.href)` matches none of those.
 */
function containsActive(item: NavItem, pathname: string) {
  const on = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return on(item.href) || Boolean(item.children?.some((c) => on(c.href)));
}

const hasKids = (item: NavItem) => Boolean(item.children?.length);

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, currentUser, logout } = useRole();
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  const { t } = useLanguage();
  const isCollapsed = !mobile && collapsed;
  const items = filterNavByRole(navItems, role);

  // Only the group holding the current route starts open: ~20 rows become 8
  // plus one group's children. User toggles win from then on, so a group never
  // auto-closes while you navigate inside it.
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const group = items.find(
      (item) => hasKids(item) && containsActive(item, pathname),
    );
    return group ? { [group.labelKey]: true } : {};
  });

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleNavClick = () => {
    if (mobile) setMobileOpen(false);
  };

  const marker = <span className="sidebar-marker" aria-hidden="true" />;

  return (
    <div className="group/rail relative flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header. The bottom rule is kept so the rail's and the navbar's
          bottom edges read as one continuous line across the app. */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-2" : "pl-[17px] pr-3",
        )}
      >
        <Link
          href="/dashboard"
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-[7px] overflow-hidden rounded-[var(--radius-md)]",
            FOCUS_RING,
          )}
        >
          {/* 28px mark, centre on x=31 — the icon axis the whole list uses. */}
          <div className="glow-primary flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="size-4" />
          </div>
          {!isCollapsed && (
            <span className="sidebar-label-in truncate text-lg font-bold tracking-tight text-gradient-brand">
              MyanFlix
            </span>
          )}
        </Link>
      </div>

      {/* The single collapse control: one 22px circle pinned to the rail's
          right border at the header's vertical centre, identical in both
          states so the affordance never moves. z-40 clears the navbar's
          sticky z-30 band, which it overhangs into. */}
      {!mobile && (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={
            isCollapsed ? t.common.expandSidebar : t.common.collapseSidebar
          }
          className={cn(
            "absolute right-0 top-8 z-40 flex size-[22px] -translate-y-1/2 translate-x-1/2",
            "items-center justify-center rounded-full border border-sidebar-border",
            "bg-sidebar text-sidebar-foreground/70",
            "opacity-50 transition-opacity duration-[140ms] group-hover/rail:opacity-100",
            "hover:text-sidebar-foreground focus-visible:opacity-100",
            "[@media(hover:none)]:opacity-100",
            FOCUS_RING,
          )}
        >
          <ChevronsLeft
            className={cn(
              "size-3 transition-transform duration-[180ms]",
              EASE_SPATIAL,
              isCollapsed && "rotate-180",
            )}
          />
        </button>
      )}

      <nav
        className={cn(
          "flex-1 overflow-y-auto scrollbar-thin px-0 pb-3 pt-[10px]",
        )}
      >
        <ul
          className={cn("flex flex-col", isCollapsed ? "gap-1" : "gap-[2px]")}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            const isGroup = Boolean(item.children && item.children.length > 0);

            // Section rules are derived, never hardcoded: draw a hairline
            // between adjacent top-level items whenever `hasKids` flips. That
            // produces the same three zones (Dashboard | the four groups |
            // Subscriptions, Roles, Settings) from data alone — no captions,
            // no lookup table, no new i18n keys, and no orphan rule when a
            // role filters a group away.
            const prev = items[index - 1];
            const rule =
              prev && hasKids(prev) !== hasKids(item) ? (
                <li
                  key={`rule-${item.labelKey}`}
                  role="separator"
                  aria-hidden="true"
                  className={cn(
                    "my-1.5 h-px bg-sidebar-border",
                    isCollapsed ? "mx-4" : "ml-[10px] mr-3",
                  )}
                />
              ) : null;

            /* ---------------- expanded group ---------------- */
            if (isGroup && !isCollapsed) {
              const open = openMenus[item.labelKey] ?? false;
              const childActiveInside = Boolean(
                item.children?.some((c) => isChildActive(pathname, c.href)),
              );
              const holdsActive = containsActive(item, pathname);
              // One fill on screen: an open group whose child is active hands
              // the pill and the marker down to that child and keeps only the
              // colour. A closed group holding the route takes the full
              // treatment, so location is never lost behind a fold.
              const lit = open && childActiveInside;
              const active = holdsActive && !lit;

              return (
                <Fragment key={item.labelKey}>
                  {rule}
                  <li className="relative">
                    {active && marker}
                    <Collapsible
                      open={open}
                      onOpenChange={(next) =>
                        setOpenMenus((prev) => ({
                          ...prev,
                          [item.labelKey]: next,
                        }))
                      }
                    >
                      <div className={ROW_INSET}>
                        <CollapsibleTrigger
                          className={cn(
                            ROW_BASE,
                            "h-9 gap-3 px-3 font-medium",
                            active &&
                              cn(ACTIVE_FILL, "font-semibold text-foreground"),
                            !active &&
                              cn(
                                lit
                                  ? "text-foreground"
                                  : "text-sidebar-foreground/72",
                                HOVER_FILL,
                              ),
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4.5 shrink-0 transition-colors duration-[120ms]",
                              active && "text-primary",
                              !active &&
                                (lit
                                  ? "text-primary/70"
                                  : "text-sidebar-foreground/60 group-hover/row:text-sidebar-foreground/85"),
                            )}
                          />
                          <span className="sidebar-label-in flex-1 truncate text-left">
                            {t.nav[item.labelKey]}
                          </span>
                          {/* The only trailing element in the list; a group
                            parent's chevron is its sole tell. */}
                          <ChevronDown
                            className={cn(
                              "size-3.5 shrink-0 text-sidebar-foreground/45 transition-transform duration-[180ms]",
                              EASE_SPATIAL,
                              open && "rotate-180",
                            )}
                          />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent
                        className={cn(
                          "h-[var(--collapsible-panel-height)] overflow-hidden",
                          "transition-[height] duration-200",
                          EASE_SPATIAL,
                          "data-starting-style:h-0 data-ending-style:h-0",
                          "[&[hidden]:not([hidden='until-found'])]:hidden",
                          // No per-child stagger: Finance has seven children
                          // and a stagger reads as lag.
                          "[&_ul]:transition-opacity [&_ul]:duration-[140ms]",
                          "[&[data-starting-style]_ul]:opacity-0",
                          "[&[data-ending-style]_ul]:opacity-0",
                        )}
                      >
                        {/* Guide line at x=31 — the parent icon's centre, so
                            the branch descends out of the glyph. It runs to the
                            vertical centre of the last child (row height 32 →
                            100% - 16px), derived rather than measured. */}
                        <ul
                          className={cn(
                            "relative mb-1.5 mt-[2px] flex flex-col gap-px",
                            "before:absolute before:left-[31px] before:top-0 before:w-px",
                            "before:h-[calc(100%-16px)]",
                            "before:bg-[color-mix(in_oklab,var(--sidebar-foreground)_14%,transparent)]",
                          )}
                        >
                          {item.children?.map((child) => {
                            const childActive = isChildActive(
                              pathname,
                              child.href,
                            );
                            const ChildIcon = child.icon;
                            return (
                              <li
                                key={child.href}
                                className={cn("relative", ROW_INSET)}
                              >
                                {childActive && marker}
                                {childActive && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute left-[30px] top-0 h-full w-[2px] rounded-full bg-[var(--primary)]"
                                  />
                                )}
                                <Link
                                  href={child.href}
                                  onClick={handleNavClick}
                                  className={cn(
                                    ROW_BASE,
                                    "h-8 gap-2.5 pl-[32px] pr-3",
                                    childActive
                                      ? cn(
                                          ACTIVE_FILL,
                                          "font-semibold text-foreground",
                                        )
                                      : cn(
                                          "font-normal text-sidebar-foreground/60",
                                          HOVER_FILL,
                                        ),
                                  )}
                                >
                                  <ChildIcon
                                    className={cn(
                                      "size-3.5 shrink-0 transition-colors duration-[120ms]",
                                      childActive
                                        ? "text-primary"
                                        : "text-sidebar-foreground/48 group-hover/row:text-sidebar-foreground/73",
                                    )}
                                  />
                                  <span className="truncate">
                                    {t.nav[child.labelKey]}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                </Fragment>
              );
            }

            /* ---------------- collapsed group (popover) ---------------- */
            if (isGroup && isCollapsed) {
              const active = containsActive(item, pathname);
              const iconLink = (
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    ROW_BASE,
                    "size-10 justify-center",
                    active
                      ? cn(ACTIVE_FILL, "text-foreground")
                      : cn("text-sidebar-foreground/72", HOVER_FILL),
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0 transition-colors duration-[120ms]",
                      active
                        ? "text-primary"
                        : "text-sidebar-foreground/60 group-hover/row:text-sidebar-foreground/85",
                    )}
                  />
                </Link>
              );
              return (
                <Fragment key={item.labelKey}>
                  {rule}
                  <li className={cn("relative", ROW_INSET_COLLAPSED)}>
                    {active && marker}
                    <Popover>
                      <PopoverTrigger
                        render={iconLink}
                        openOnHover
                        delay={100}
                        closeDelay={150}
                      />
                      {/* The popover is not the rail: no marker here, and the
                          child glyphs go back to work at 55% because there is
                          no guide line doing the structural job. */}
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="w-52 p-1.5"
                      >
                        <p className="truncate px-2 pb-1.5 pt-1 text-[11px] font-semibold text-muted-foreground">
                          {t.nav[item.labelKey]}
                        </p>
                        <ul className="flex flex-col gap-0.5">
                          {item.children?.map((child) => {
                            const childActive = isChildActive(
                              pathname,
                              child.href,
                            );
                            const ChildIcon = child.icon;
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={handleNavClick}
                                  className={cn(
                                    "flex h-[30px] items-center gap-2.5 rounded-[var(--radius-md)] px-2",
                                    "text-[0.8125rem] leading-[1.35] transition-colors duration-[120ms]",
                                    EASE_COLOR,
                                    FOCUS_RING,
                                    childActive
                                      ? cn(
                                          ACTIVE_FILL,
                                          "font-semibold text-foreground",
                                        )
                                      : "text-popover-foreground/80 hover:bg-[color-mix(in_oklab,var(--sidebar-accent)_55%,transparent)] hover:text-foreground",
                                  )}
                                >
                                  <ChildIcon
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      childActive
                                        ? "text-primary"
                                        : "text-popover-foreground/55",
                                    )}
                                  />
                                  <span className="truncate">
                                    {t.nav[child.labelKey]}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  </li>
                </Fragment>
              );
            }

            /* ---------------- leaf ---------------- */
            const active = pathname === item.href;
            const linkContent = (
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  ROW_BASE,
                  isCollapsed ? "size-10 justify-center" : "h-9 gap-3 px-3",
                  "font-medium",
                  active
                    ? cn(ACTIVE_FILL, "font-semibold text-foreground")
                    : cn("text-sidebar-foreground/72", HOVER_FILL),
                )}
              >
                <Icon
                  className={cn(
                    "size-4.5 shrink-0 transition-colors duration-[120ms]",
                    active
                      ? "text-primary"
                      : "text-sidebar-foreground/60 group-hover/row:text-sidebar-foreground/85",
                  )}
                />
                {!isCollapsed && (
                  <span className="sidebar-label-in truncate">
                    {t.nav[item.labelKey]}
                  </span>
                )}
              </Link>
            );

            return (
              <Fragment key={item.href}>
                {rule}
                <li
                  className={cn(
                    "relative",
                    isCollapsed ? ROW_INSET_COLLAPSED : ROW_INSET,
                  )}
                >
                  {active && marker}
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger render={linkContent} />
                      <TooltipContent side="right">
                        {t.nav[item.labelKey]}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkContent
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>

      {/* Footer — now the rail's only bottom chrome. */}
      <div className="h-[60px] shrink-0 border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={cn(
                  "flex h-11 w-full items-center gap-2.5 rounded-[var(--radius-md)] p-1.5 text-left",
                  "transition-colors duration-[120ms]",
                  EASE_COLOR,
                  FOCUS_RING,
                  // Never the active pill: the footer is not a destination.
                  "hover:bg-[color-mix(in_oklab,var(--sidebar-accent)_55%,transparent)]",
                  isCollapsed && "justify-center",
                )}
              />
            }
          >
            <Avatar className="size-8 shrink-0 ring-1 ring-sidebar-border">
              <AvatarImage
                src={currentUser.avatarUrl ?? undefined}
                alt={currentUser.name}
              />
              <AvatarFallback>{currentUser.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold leading-[1.35] text-foreground">
                    {currentUser.name}
                  </p>
                  <RoleBadge
                    role={role}
                    className="mt-0.5 h-[18px] px-1.5 text-[10px]"
                  />
                </div>
                {/* Nothing signalled that this block opens a menu. */}
                <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/45" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">
                {currentUser.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                {t.common.logOut}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
