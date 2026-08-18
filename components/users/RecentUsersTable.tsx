"use client";

import { format } from "date-fns";
import { UserRoundPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/lib/context/language-context";
import { formatLocalPhone } from "@/lib/phone";
import type { AppUser } from "@/types/user";

export function RecentUsersTable({ users }: { users: AppUser[] }) {
  const { t } = useLanguage();

  if (!users.length) {
    return (
      <EmptyState
        icon={UserRoundPlus}
        title={t.users.recentUsersTable.emptyTitle}
        description={t.users.recentUsersTable.emptyDescription}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t.users.recentUsersTable.name}</TableHead>
          <TableHead>{t.users.recentUsersTable.phone}</TableHead>
          <TableHead>{t.users.recentUsersTable.joined}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{user.name}</span>
              </div>
            </TableCell>
            <TableCell className="truncate text-sm text-muted-foreground">
              {formatLocalPhone(user.phone) ?? "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(user.joinDate), "d MMM yyyy")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
