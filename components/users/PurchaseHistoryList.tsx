import Image from "next/image";
import { format } from "date-fns";
import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatKyat } from "@/lib/currency";
import type { PurchaseEntry } from "@/types/user";

export function PurchaseHistoryList({ entries }: { entries: PurchaseEntry[] }) {
  if (!entries.length) {
    return (
      <EmptyState icon={ShoppingBag} title="No purchases yet" description="Movies bought will show up here." />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3">
          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
            {entry.posterUrl && (
              <Image src={entry.posterUrl} alt={entry.movieTitle} fill className="object-cover" sizes="44px" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.movieTitle}</p>
            <p className="text-xs text-muted-foreground">
              Purchased {format(new Date(entry.purchasedAt), "MMM d, yyyy")}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium">{formatKyat(entry.price)}</span>
        </li>
      ))}
    </ul>
  );
}
