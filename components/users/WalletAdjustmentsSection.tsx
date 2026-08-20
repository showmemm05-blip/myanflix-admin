"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { formatKyat, formatSignedKyat } from "@/lib/currency";
import { userLabelOr } from "@/lib/user-label";
import { userService } from "@/services/api/userService";
import type { WalletAdjustment, WalletAdjustmentDirection } from "@/types/wallet-adjustment";

const DIRECTION_BADGE_STYLES: Record<WalletAdjustmentDirection, string> = {
  CREDIT: "bg-income/15 text-income border-income/25",
  DEBIT: "bg-outgoing/15 text-outgoing border-outgoing/25",
};

const AMOUNT_STYLES: Record<WalletAdjustmentDirection, string> = {
  CREDIT: "text-income",
  DEBIT: "text-outgoing",
};

/**
 * Audit trail of manual wallet adjustments for one user. Fetches its own data
 * (the endpoint is WALLET_ADJUST / Super Admin only, so it can't ride along in
 * the page's shared fetch without 403-ing everyone else) — the parent bumps
 * `refreshKey` after a successful adjustment to reload the list.
 */
const PAGE_SIZE = 10;

export function WalletAdjustmentsSection({
  userId,
  refreshKey = 0,
}: {
  userId: string;
  refreshKey?: number;
}) {
  const { t } = useLanguage();
  // Server-side paging — the audit trail must stay reachable no matter how
  // long it grows, so we never cap at one fetched page.
  const [page, setPage] = useState(1);
  // A new adjustment was just saved — snap back to page 1 where it appears.
  // (State-adjust-during-render, the sanctioned alternative to a setState
  // effect.)
  const [seenRefreshKey, setSeenRefreshKey] = useState(refreshKey);
  if (refreshKey !== seenRefreshKey) {
    setSeenRefreshKey(refreshKey);
    setPage(1);
  }

  const { data, isLoading, error, refetch } = useAsyncData(
    () => userService.getWalletAdjustments(userId, { page, limit: PAGE_SIZE }),
    [userId, refreshKey, page],
  );
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const columns: ColumnDef<WalletAdjustment>[] = [
    {
      accessorKey: "createdAt",
      header: t.walletAdjustments.section.columns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      accessorKey: "direction",
      header: t.walletAdjustments.section.columns.direction,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn("font-medium", DIRECTION_BADGE_STYLES[row.original.direction])}
        >
          {row.original.direction === "CREDIT"
            ? t.walletAdjustments.section.directionCredit
            : t.walletAdjustments.section.directionDebit}
        </Badge>
      ),
    },
    {
      accessorKey: "amount",
      header: t.walletAdjustments.section.columns.amount,
      cell: ({ row }) => (
        <span className={cn("font-semibold tabular-nums", AMOUNT_STYLES[row.original.direction])}>
          {formatSignedKyat(row.original.amount, row.original.direction === "CREDIT" ? "in" : "out")}
        </span>
      ),
    },
    {
      id: "balanceChange",
      header: t.walletAdjustments.section.columns.balance,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatKyat(row.original.balanceBefore)}
          <span className="mx-1">→</span>
          {formatKyat(row.original.balanceAfter)}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: t.walletAdjustments.section.columns.reason,
      cell: ({ row }) => (
        <span className="block max-w-56 truncate text-sm" title={row.original.reason}>
          {row.original.reason}
        </span>
      ),
    },
    {
      id: "performedBy",
      header: t.walletAdjustments.section.columns.performedBy,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {userLabelOr(row.original.performedBy, "—")}
        </span>
      ),
    },
  ];

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t.walletAdjustments.section.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState description={t.walletAdjustments.section.loadError} onRetry={refetch} />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              isLoading={isLoading}
              pageSize={PAGE_SIZE}
              emptyState={
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t.walletAdjustments.section.emptyTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.walletAdjustments.section.emptyDescription}
                  </p>
                </div>
              }
            />
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.walletAdjustments.section.pageOf(page, totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  aria-label={t.walletAdjustments.section.previousPage}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  aria-label={t.walletAdjustments.section.nextPage}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
