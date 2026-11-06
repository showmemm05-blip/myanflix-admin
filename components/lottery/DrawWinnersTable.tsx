"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { getWinnerColumns } from "@/components/lottery/winnerColumns";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";

/** Winner rows per server page — a draw's winners are a short list next to its tickets. */
const PAGE_SIZE = 25;

interface DrawWinnersTableProps {
  drawId: string;
}

/**
 * A published draw's winning tickets, biggest prize first: server search
 * (300 ms debounce) over ticket ID / number / customer, server paging.
 * Shown on the draw page once it is published; the rows come from the
 * payouts, each with its claim status — paid ones are exactly what the
 * wallets received.
 */
export function DrawWinnersTable({ drawId }: DrawWinnersTableProps) {
  const { t } = useLanguage();
  const w = t.lottery.draws.detail.winners;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim();
      if (next === appliedSearch) return;
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () => lotteryService.listDrawWinners(drawId, { q: appliedSearch || undefined, page, pageSize: PAGE_SIZE }),
    [drawId, appliedSearch, page],
  );
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const columns = getWinnerColumns({ t });
  const rows = data?.items ?? [];
  const noWinnersAtAll = !isLoading && !error && data?.total === 0 && !appliedSearch;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">{w.title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{w.description}</p>
      {error ? (
        <ErrorState description={w.loadError} onRetry={refetch} />
      ) : noWinnersAtAll ? (
        <EmptyState icon={Trophy} title={w.empty} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            pageSize={PAGE_SIZE}
            manualPagination
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={w.searchPlaceholder}
            emptyState={<p className="text-sm text-muted-foreground">{w.noMatches}</p>}
          />
          {!isLoading && data && (
            <ServerPagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
