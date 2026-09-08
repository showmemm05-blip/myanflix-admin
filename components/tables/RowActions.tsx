"use client";

/**
 * Per-row action buttons — the replacement for the "…" dropdown menu that
 * used to sit at the end of every admin table row.
 *
 * Each former menu item becomes one `RowActionButton`: a ghost icon button
 * with the item's label as tooltip + `aria-label` (+ `title` fallback), so
 * the i18n strings the menus already used carry over unchanged. Callers keep
 * their handlers, permission gates, disabled rules and destructive marking —
 * only the presentation changes.
 *
 * Icon mapping (use these consistently across migrations):
 *   Eye          — view / open details
 *   Pencil       — edit
 *   Trash2       — delete (always `destructive`, always last)
 *   Power        — enable / disable, activate / deactivate (status toggle)
 *   Rocket       — publish (matches the existing Publish button in movies)
 *   RefreshCw    — reprocess / retry
 *   KeyRound     — reset password
 *   EyeOff / Eye — hide / show (comments)
 *   ShieldCheck  — role / permission actions
 *
 * Layout: buttons keep the primitive's `icon-sm` size (28px) — exactly the
 * old "…" trigger's size — so no row grows taller than it was. Focus ring: the house ring lives on the
 * Button primitive itself (`focus-visible:ring-2 focus-visible:ring-ring
 * focus-visible:border-ring`); there is no separate `focus-ring` utility in
 * globals.css, so nothing extra is added here.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Right-aligned flex row wrapping the buttons for one table row. */
export function RowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-0.5", className)}>
      {children}
    </div>
  );
}

export interface RowActionButtonProps {
  icon: LucideIcon;
  /** Tooltip text and accessible name — reuse the former menu-item label. */
  label: string;
  onClick?: () => void;
  /** When set, renders a real `<a>` (Next `Link`) so navigation stays a link. */
  href?: string;
  /** Destructive tint — delete-style actions. */
  destructive?: boolean;
  disabled?: boolean;
  /**
   * Shows a spinner in place of the icon and disables the button, exactly
   * like the old menu items that were `disabled` while their own request was
   * in flight (prevents a double-trigger).
   */
  loading?: boolean;
  className?: string;
}

export function RowActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  destructive = false,
  disabled = false,
  loading = false,
  className,
}: RowActionButtonProps) {
  const inactive = disabled || loading;

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(
        "rounded-md",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      aria-label={label}
      disabled={inactive}
      onClick={onClick}
      {...(href ? { render: <Link href={href} />, nativeButton: false } : {})}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Icon className="size-4" />
      )}
    </Button>
  );

  return (
    <Tooltip>
      {inactive ? (
        // A disabled button swallows pointer events, so the tooltip has to
        // hang off a wrapper to stay reachable (same as RoleDetail's delete).
        <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
      ) : (
        <TooltipTrigger render={button} />
      )}
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
