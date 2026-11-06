"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { getDrawColumns } from "@/components/lottery/drawColumns";
import { DrawStatusTabs } from "@/components/lottery/DrawStatusTabs";
import { NewDrawDialog } from "@/components/lottery/NewDrawDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryAdminDraw, LotteryDrawFilter } from "@/types/lottery";

/** Rows per server page: two draws a month, so a page is years of draws. */
const PAGE_SIZE = 25;

/**
 * The Lottery "Draws" page (2026-10-19): one row per Thai lottery draw,
 * newest first, with its sales counters. LOTTERY.VIEW reads, LOTTERY
 * .DRAWS_MANAGE creates (everything else about a draw happens on its own
 * page); the backend audits every change.
 *
 * The status tabs run on the SERVER: the list is paged, so filtering the
 * loaded page client-side would hide every match past it.
 */
function DrawsContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const router = useRouter();
  const canManage = can("LOTTERY.DRAWS_MANAGE");
  const d = t.lottery.draws;

  const [filter, setFilter] = useState<LotteryDrawFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      lotteryService.listDraws({
        status: filter === "all" ? undefined : filter,
        page,
        pageSize: PAGE_SIZE,
      }),
    [filter, page],
  );
  const draws = data?.items ?? [];
  // A draw that changes status elsewhere can leave a later page of a status
  // tab empty: step back to the last page that has rows.
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const changeFilter = (next: LotteryDrawFilter) => {
    setFilter(next);
    setPage(1);
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  const openCreate = () => {
    setCreateKey((k) => k + 1);
    setCreateOpen(true);
  };

  // A new draw's next step is opening its sales, which lives on its page.
  const handleCreated = (draw: LotteryAdminDraw) => {
    refetch();
    router.push(`/lottery/draws/${draw.id}`);
  };

  const columns = getDrawColumns({ t });

  const newDrawButton = canManage && (
    <Button onClick={openCreate}>
      <Plus className="size-4" />
      {d.newDraw}
    </Button>
  );

  return (
    <div>
      <PageHeader title={d.title} description={d.description} actions={newDrawButton} />
      {!canManage && <p className="-mt-3 mb-4 text-sm text-muted-foreground">{d.readOnly}</p>}

      {error ? (
        <ErrorState description={d.loadError} onRetry={refetch} />
      ) : !isLoading && draws.length === 0 && filter === "all" && page === 1 ? (
        <EmptyState icon={CalendarDays} title={d.emptyTitle} description={d.emptyDescription} action={newDrawButton} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={draws}
            isLoading={isLoading}
            pageSize={PAGE_SIZE}
            manualPagination
            toolbar={<DrawStatusTabs value={filter} onValueChange={changeFilter} />}
            emptyState={<p className="text-sm text-muted-foreground">{d.noMatches}</p>}
          />
          {!isLoading && data && (
            <ServerPagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          )}
        </>
      )}

      {canManage && createOpen && (
        <NewDrawDialog key={createKey} open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
      )}
    </div>
  );
}

export default function LotteryDrawsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="LOTTERY.VIEW" title={t.lottery.draws.title} description={t.lottery.draws.description}>
      <DrawsContent />
    </RequirePermission>
  );
}
