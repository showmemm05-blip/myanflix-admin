"use client";

import { Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserRole } from "@/types/user";
import type { RolePermissions } from "@/services/api/rolesService";
import { useLanguage } from "@/lib/context/language-context";

const ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "USER"];

const PERMISSION_KEYS = [
  "MOVIE_CREATE",
  "MOVIE_UPDATE",
  "MOVIE_DELETE",
  "VIDEO_UPLOAD",
  "USER_MANAGE",
  "FINANCE_VIEW",
  "SUBSCRIPTION_MANAGE",
  "STAFF_MANAGE",
] as const;

export function PermissionMatrix({ matrix }: { matrix: RolePermissions[] }) {
  const { t } = useLanguage();
  const permissionLabels: Record<(typeof PERMISSION_KEYS)[number], { label: string; description: string }> = {
    MOVIE_CREATE: t.roles.permissions.movieCreate,
    MOVIE_UPDATE: t.roles.permissions.movieUpdate,
    MOVIE_DELETE: t.roles.permissions.movieDelete,
    VIDEO_UPLOAD: t.roles.permissions.videoUpload,
    USER_MANAGE: t.roles.permissions.userManage,
    FINANCE_VIEW: t.roles.permissions.financeView,
    SUBSCRIPTION_MANAGE: t.roles.permissions.subscriptionManage,
    STAFF_MANAGE: t.roles.permissions.staffManage,
  };
  const permissionsByRole = new Map(matrix.map((m) => [m.role, new Set(m.permissions)]));

  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="px-4">{t.roles.matrix.permissionHeader}</TableHead>
            {ROLES.map((role) => (
              <TableHead key={role} className="px-4 text-center">
                {t.common.roleLabels[role]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {PERMISSION_KEYS.map((key) => {
            const info = permissionLabels[key];
            return (
              <TableRow key={key} className="border-border hover:bg-secondary/50">
                <TableCell className="px-4 py-3">
                  <p className="font-medium">{info.label}</p>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </TableCell>
                {ROLES.map((role) => {
                  const granted = permissionsByRole.get(role)?.has(key) ?? false;
                  return (
                    <TableCell key={role} className="px-4 py-3 text-center">
                      {granted ? (
                        <Check className="mx-auto size-4 text-success" />
                      ) : (
                        <X className="mx-auto size-4 text-muted-foreground/60" />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
