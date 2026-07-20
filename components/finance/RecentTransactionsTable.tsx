import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Receipt } from "lucide-react";
import { formatKyat } from "@/lib/currency";
import type { Transaction, TransactionStatus } from "@/types/transaction";

const STATUS_TONE: Record<TransactionStatus, StatusTone> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
};

export function RecentTransactionsTable({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="No transactions yet"
        description="Purchases and subscriptions will show up here as they happen."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>User</TableHead>
          <TableHead>Movie</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarImage src={txn.userAvatarUrl} alt={txn.userName} />
                  <AvatarFallback>{txn.userName.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{txn.userName}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {txn.movieTitle ?? <span className="italic">—</span>}
            </TableCell>
            <TableCell
              className={`text-sm font-medium tabular-nums ${txn.amount < 0 ? "text-destructive" : ""}`}
            >
              {formatKyat(txn.amount)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(txn.createdAt), "MMM d, yyyy")}
            </TableCell>
            <TableCell>
              <StatusBadge label={txn.status} tone={STATUS_TONE[txn.status]} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
