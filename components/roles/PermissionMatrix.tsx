import { Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, type UserRole } from "@/types/user";
import type { RolePermissions } from "@/services/api/rolesService";

const ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "USER"];

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  MOVIE_CREATE: { label: "Upload Movies", description: "Add new titles to the catalog" },
  MOVIE_UPDATE: { label: "Edit Movies", description: "Update movie details and status" },
  MOVIE_DELETE: { label: "Delete Movies", description: "Remove titles from the catalog" },
  VIDEO_UPLOAD: { label: "Video Upload", description: "Upload and process video files" },
  USER_MANAGE: { label: "Manage Users", description: "View users, change roles, suspend accounts" },
  FINANCE_VIEW: { label: "View Finance", description: "See platform-wide revenue and transactions" },
};

export function PermissionMatrix({ matrix }: { matrix: RolePermissions[] }) {
  const permissionKeys = Object.keys(PERMISSION_LABELS);
  const permissionsByRole = new Map(matrix.map((m) => [m.role, new Set(m.permissions)]));

  return (
    <div className="glass-card overflow-hidden rounded-xl border-white/[0.08]">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.08] hover:bg-transparent">
            <TableHead className="px-4">Permission</TableHead>
            {ROLES.map((role) => (
              <TableHead key={role} className="px-4 text-center">
                {ROLE_LABELS[role]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissionKeys.map((key) => {
            const info = PERMISSION_LABELS[key];
            return (
              <TableRow key={key} className="border-white/[0.08]">
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
                        <X className="mx-auto size-4 text-muted-foreground/40" />
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
