"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";
import type { Permission } from "@/lib/permissions";
import type { PermissionCatalogueModule } from "@/types/role";

interface PermissionMatrixProps {
  modules: PermissionCatalogueModule[];
  /** The working (possibly dirty) selection — not what the server has. */
  selected: ReadonlySet<Permission>;
  onToggle: (permission: Permission, next: boolean) => void;
  /** Bulk-sets every action in one module — the header's select-all. */
  onSetModule: (permissions: Permission[], next: boolean) => void;
  /** True for the protected SUPER_ADMIN role: everything shown, nothing editable. */
  readOnly: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}

/**
 * The editable permission grid, grouped by module with one checkbox per
 * action. The search box filters on module and action labels at once, so
 * typing "delete" narrows every module down to its delete action rather than
 * hiding whole modules.
 */
export function PermissionMatrix({
  modules,
  selected,
  onToggle,
  onSetModule,
  readOnly,
  search,
  onSearchChange,
}: PermissionMatrixProps) {
  const { t } = useLanguage();

  const visibleModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;
    return modules
      .map((module) => {
        // A module matching by name keeps all of its actions, so searching
        // "movies" shows the whole module rather than nothing.
        if (module.label.toLowerCase().includes(query) || module.key.toLowerCase().includes(query)) {
          return module;
        }
        const actions = module.actions.filter(
          (action) =>
            action.label.toLowerCase().includes(query) ||
            action.permission.toLowerCase().includes(query),
        );
        return actions.length > 0 ? { ...module, actions } : null;
      })
      .filter((module): module is PermissionCatalogueModule => module !== null);
  }, [modules, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.roles.matrix.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {visibleModules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t.roles.matrix.noMatches}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleModules.map((module) => {
            const permissions = module.actions.map((action) => action.permission);
            const grantedCount = permissions.filter((p) => selected.has(p)).length;
            const allGranted = grantedCount === permissions.length;

            return (
              <section
                key={module.key}
                className="overflow-hidden rounded-xl border border-border bg-card/40"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{module.label}</p>
                    <Badge variant="secondary" className="tabular-nums font-normal">
                      {t.roles.matrix.selectedOfTotal(grantedCount, permissions.length)}
                    </Badge>
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t.roles.matrix.moduleSelectAll(module.label)}
                      onClick={() => onSetModule(permissions, !allGranted)}
                    >
                      {allGranted ? t.roles.matrix.disableAll : t.roles.matrix.enableAll}
                    </Button>
                  )}
                </header>

                <div className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
                  {module.actions.map((action) => {
                    const id = `perm-${action.permission}`;
                    const checked = selected.has(action.permission);
                    return (
                      <div key={action.permission} className="flex items-center gap-2.5 py-1.5">
                        <Checkbox
                          id={id}
                          checked={checked}
                          disabled={readOnly}
                          onCheckedChange={(next) => onToggle(action.permission, next === true)}
                        />
                        <Label htmlFor={id} className="flex min-w-0 flex-col gap-0.5 font-normal">
                          <span className="text-sm">{action.label}</span>
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {action.permission}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
