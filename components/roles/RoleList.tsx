"use client";

import { Lock, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/context/language-context";
import type { AppRole } from "@/types/role";

interface RoleListProps {
  roles: AppRole[];
  selectedId: string | null;
  onSelect: (role: AppRole) => void;
  /** ROLES.CREATE — hides the "New role" button when absent. */
  canCreate: boolean;
  onCreate: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

/**
 * The left rail: every role, in the order the API returns them (built-ins
 * first). The search box filters on name and key so an operator can find a
 * custom role in a long list without scanning.
 */
export function RoleList({
  roles,
  selectedId,
  onSelect,
  canCreate,
  onCreate,
  search,
  onSearchChange,
}: RoleListProps) {
  const { t } = useLanguage();

  return (
    <div className="glass-card flex h-full flex-col gap-3 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold">{t.roles.list.heading}</p>
        {canCreate && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" />
            {t.roles.list.newRole}
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.roles.list.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {roles.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          {search ? t.roles.list.noMatches : t.roles.list.emptyDescription}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {roles.map((role) => {
            const isSelected = role.id === selectedId;
            return (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => onSelect(role)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:bg-secondary/60",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {role.isProtected ? (
                      <Lock className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {role.name}
                    </span>
                    {role.isSystem && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {role.isProtected
                          ? t.roles.list.protectedBadge
                          : t.roles.list.systemBadge}
                      </Badge>
                    )}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {role.key}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t.roles.list.memberCount(role.userCount)} ·{" "}
                    {t.roles.list.permissionCount(role.permissions.length)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
