"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RoleList } from "@/components/roles/RoleList";
import { RoleDetail } from "@/components/roles/RoleDetail";
import { RoleFormDialog } from "@/components/roles/RoleFormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { rolesService } from "@/services/api/rolesService";
import { ApiError } from "@/services/api/apiClient";
import type { Permission } from "@/lib/permissions";
import type { AppRole, PermissionCatalogueModule } from "@/types/role";

/** Stable empty references so hook deps do not churn before the first load. */
const EMPTY_ROLES: AppRole[] = [];
const EMPTY_MODULES: PermissionCatalogueModule[] = [];

function RolesPageContent() {
  const { t } = useLanguage();
  const { can, refreshProfile } = useRole();
  const canCreate = can("ROLES.CREATE");
  const canEdit = can("ROLES.EDIT");
  const canDelete = can("ROLES.DELETE");

  const { data, isLoading, error, refetch } = useAsyncData(
    async () => {
      const [roles, catalogue] = await Promise.all([
        rolesService.getRoles(),
        rolesService.getCatalogue(),
      ]);
      return { roles, catalogue };
    },
    [],
  );

  // Roles are held locally after the first load so a save patches one row
  // instead of refetching the whole list (and losing the scroll position).
  const [roleOverrides, setRoleOverrides] = useState<AppRole[] | null>(null);
  // Memoized because it feeds hook dependency lists — a fresh `[]` literal on
  // every render would otherwise invalidate them continuously.
  const roles = useMemo(
    () => roleOverrides ?? data?.roles ?? EMPTY_ROLES,
    [roleOverrides, data],
  );
  const modules = data?.catalogue.modules ?? EMPTY_MODULES;

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Null means "no local edits" — the matrix then mirrors the selected role.
  const [draft, setDraft] = useState<Set<Permission> | null>(null);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AppRole | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(query) || role.key.toLowerCase().includes(query),
    );
  }, [roles, search]);

  // Falling back to the first role keeps the detail pane populated on load
  // and after a delete, without an effect that writes state during render.
  const selectedRole =
    roles.find((role) => role.id === selectedId) ?? visibleRoles[0] ?? roles[0] ?? null;

  const saved = useMemo(
    () => new Set<Permission>(selectedRole?.permissions ?? []),
    [selectedRole],
  );
  const selected = draft ?? saved;

  const dirtyCount = useMemo(() => {
    if (!draft) return 0;
    let count = 0;
    for (const permission of draft) if (!saved.has(permission)) count++;
    for (const permission of saved) if (!draft.has(permission)) count++;
    return count;
  }, [draft, saved]);

  const selectRole = useCallback((role: AppRole) => {
    setSelectedId(role.id);
    setDraft(null);
  }, []);

  const togglePermission = useCallback(
    (permission: Permission, next: boolean) => {
      setDraft((prev) => {
        const base = new Set(prev ?? saved);
        if (next) base.add(permission);
        else base.delete(permission);
        return base;
      });
    },
    [saved],
  );

  const setModule = useCallback(
    (permissions: Permission[], next: boolean) => {
      setDraft((prev) => {
        const base = new Set(prev ?? saved);
        for (const permission of permissions) {
          if (next) base.add(permission);
          else base.delete(permission);
        }
        return base;
      });
    },
    [saved],
  );

  const upsertRole = useCallback(
    (role: AppRole) => {
      setRoleOverrides((prev) => {
        const list = prev ?? roles;
        return list.some((r) => r.id === role.id)
          ? list.map((r) => (r.id === role.id ? role : r))
          : [...list, role];
      });
    },
    [roles],
  );

  const handleSavePermissions = async () => {
    if (!selectedRole || !draft) return;
    setSaving(true);
    try {
      // The API takes the full desired set, not a delta — send it in
      // catalogue order so the response and the draft stay comparable.
      const updated = await rolesService.setPermissions(selectedRole.id, [...draft]);
      upsertRole(updated);
      setDraft(null);
      toast.success(t.roles.saveBar.savedToast, {
        description: t.roles.saveBar.savedDescription(updated.name),
      });
      // The caller may have just changed their own role's permissions, and
      // the guard is already live — resync so the UI stops lagging behind.
      void refreshProfile();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.roles.saveBar.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForm = async (values: { name: string; description: string }) => {
    setFormSaving(true);
    try {
      if (renameTarget) {
        const updated = await rolesService.updateRole(renameTarget.id, {
          name: values.name,
          description: values.description,
        });
        upsertRole(updated);
        toast.success(t.roles.rename.savedToast);
      } else {
        const created = await rolesService.createRole({
          name: values.name,
          description: values.description || undefined,
        });
        upsertRole(created);
        setSelectedId(created.id);
        setDraft(null);
        setSearch("");
        toast.success(t.roles.create.createdToast, {
          description: t.roles.create.createdDescription(created.name),
        });
      }
      setFormOpen(false);
      setRenameTarget(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : renameTarget
            ? t.roles.rename.failed
            : t.roles.create.failed,
      );
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await rolesService.deleteRole(deleteTarget.id);
      setRoleOverrides((prev) => (prev ?? roles).filter((r) => r.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setDraft(null);
      }
      toast.success(t.roles.remove.deletedToast);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.roles.remove.failed);
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title={t.roles.page.title} description={t.roles.page.description} />
        <ErrorState description={t.roles.loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.roles.page.title} description={t.roles.page.description} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <RoleList
            roles={visibleRoles}
            selectedId={selectedRole?.id ?? null}
            onSelect={selectRole}
            canCreate={canCreate}
            onCreate={() => {
              setRenameTarget(null);
              setFormOpen(true);
            }}
            search={search}
            onSearchChange={setSearch}
          />

          {selectedRole ? (
            <RoleDetail
              role={selectedRole}
              modules={modules}
              selected={selected}
              onToggle={togglePermission}
              onSetModule={setModule}
              dirtyCount={dirtyCount}
              saving={saving}
              onSave={handleSavePermissions}
              onDiscard={() => setDraft(null)}
              canEdit={canEdit}
              canDelete={canDelete}
              onRename={() => {
                setRenameTarget(selectedRole);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteTarget(selectedRole)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border px-6 py-24 text-center text-sm text-muted-foreground">
              {t.roles.detail.selectPrompt}
            </p>
          )}
        </div>
      )}

      <RoleFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setRenameTarget(null);
        }}
        role={renameTarget}
        saving={formSaving}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.roles.remove.title}
        description={deleteTarget ? t.roles.remove.description(deleteTarget.name) : ""}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function RolesPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="ROLES.VIEW"
      title={t.roles.page.title}
      description={t.roles.page.description}
    >
      <RolesPageContent />
    </RequirePermission>
  );
}
