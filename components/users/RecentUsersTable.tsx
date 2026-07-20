import { format } from "date-fns";
import { UserRoundPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AppUser } from "@/types/user";

export function RecentUsersTable({ users }: { users: AppUser[] }) {
  if (!users.length) {
    return (
      <EmptyState
        icon={UserRoundPlus}
        title="No new users"
        description="Newly registered subscribers will appear here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{user.name}</span>
              </div>
            </TableCell>
            <TableCell className="truncate text-sm text-muted-foreground">{user.email}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(user.joinDate), "MMM d, yyyy")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
