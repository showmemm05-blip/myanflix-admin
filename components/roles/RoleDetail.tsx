"use client";

import { useMemo, useState } from "react";
import { Info, Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionMatrix } from "@/components/roles/PermissionMatrix";
import { useLanguage } from "@/lib/context/language-context";
import type { Permission } from "@/lib/permissions";
import type { AppRole, PermissionCatalogueModule } from "@/types/role";

interface RoleDetailProps {
  role: AppRole;
  modules: PermissionCatalogueModule[];
  /** Working selection, owned by the page so it survives a re-render. */
  selected: ReadonlySet<Permission>;
  onToggle: (permission: Permission, next: boolean) => void;
  onSetModule: (permissions: Permission[], next: boolean) => void;
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  canEdit: boolean;
  canDelete: boolean;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * The right pane: one role's identity plus its permission matrix, with the
 * save/discard bar that only exists while the selection differs from what
 * the server returned.
 */
export function RoleDetail({
  role,
  modules,
  selected,
  onToggle,
  onSetModule,
  dirtyCount,
  saving,
  onSave,
  onDiscard,
  canEdit,
  canDelete,
  onRename,
  onDelete,
}: RoleDetailProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  // SUPER_ADMIN is protected: the backend answers 409 to any edit, so the
  // matrix renders as a read-only record of what it can do.
  const readOnly = role.isProtected || !canEdit;

  const deleteBlockedReason = useMemo(() => {
    if (role.isSystem) return t.roles.remove.blockedSystem;
    if (role.userCount > 0) return t.roles.remove.blockedMembers(role.userCount);
    return null;
  }, [role.isSystem, role.userCount, t]);

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-card flex flex-wrap items-start justify-between gap-4 rounded-xl p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{role.name}</h2>
            {role.isSystem && (
              <Badge variant="outline">
                {role.isProtected ? t.roles.list.protectedBadge : t.roles.list.systemBadge}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.roles.detail.keyLabel}: <span className="font-mono">{role.key}</span> ·{" "}
            {t.roles.list.memberCount(role.userCount)}
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {role.description || t.roles.detail.noDescription}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && !role.isProtected && (
            <Button variant="outline" size="sm" onClick={onRename}>
              <Pencil className="size-4" />
              {t.roles.detail.rename}
            </Button>
          )}
          {canDelete &&
            (deleteBlockedReason ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    // A disabled button swallows pointer events, so the
                    // reason has to hang off a wrapper to stay reachable.
                    <span className="inline-flex" />
                  }
                >
                  <Button variant="outline" size="sm" disabled>
                    <Trash2 className="size-4" />
                    {t.roles.detail.deleteRole}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{deleteBlockedReason}</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 className="size-4" />
                {t.roles.detail.deleteRole}
              </Button>
            ))}
        </div>
      </div>

      {(role.isProtected || role.isSystem) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/10 px-4 py-3 text-sm text-muted-foreground">
          {role.isProtected ? (
            <Lock className="mt-0.5 size-4 shrink-0 text-info" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
          )}
          {role.isProtected ? t.roles.detail.protectedNotice : t.roles.detail.systemNotice}
        </div>
      )}

      <PermissionMatrix
        modules={modules}
        selected={selected}
        onToggle={onToggle}
        onSetModule={onSetModule}
        readOnly={readOnly}
        search={search}
        onSearchChange={setSearch}
      />

      {dirtyCount > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-xl">
          <p className="text-sm font-medium tabular-nums">
            {t.roles.saveBar.unsavedChanges(dirtyCount)}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={onDiscard}>
              {t.roles.saveBar.discard}
            </Button>
            <Button size="sm" disabled={saving} onClick={onSave}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t.roles.saveBar.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
