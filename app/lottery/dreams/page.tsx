"use client";

import { useEffect, useState } from "react";
import { Download, FileUp, Images, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDreamColumns } from "@/components/lottery/columns";
import { DreamEditDialog } from "@/components/lottery/DreamEditDialog";
import { DreamFilterTabs } from "@/components/lottery/DreamFilterTabs";
import { DreamImportDialog } from "@/components/lottery/DreamImportDialog";
import { DreamPicturesImportDialog } from "@/components/lottery/DreamPicturesImportDialog";
import { dreamErrorMessage, exportFileName, saveBlob } from "@/components/lottery/dreamFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_DREAM_BOOKS,
  type LotteryDream,
  type LotteryDreamBook,
  type LotteryDreamFilter,
} from "@/types/lottery";

/** Rows per server page — the 1000 book is paged on the server, so every number is reachable. */
const PAGE_SIZE = 50;

/**
 * The Lottery "Dreams" page (2026-10-19): the two dream books, one row per
 * number, created up front. The admin fills in names and pictures by
 * editing a row or by importing a spreadsheet. LOTTERY.VIEW reads and
 * exports, LOTTERY.DREAMS_MANAGE edits and imports; the backend audits
 * every change.
 *
 * Search and the filter tabs run on the SERVER: the list is paged, so
 * filtering the loaded page client-side would hide every match past it.
 */
function DreamsContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canManage = can("LOTTERY.DREAMS_MANAGE");
  const d = t.lottery.dreams;

  const [book, setBook] = useState<LotteryDreamBook>("1000");
  const [filter, setFilter] = useState<LotteryDreamFilter>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim();
      if (next === appliedSearch) return;
      // A new search starts again from its first page.
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      lotteryService.listDreams({
        book,
        q: appliedSearch || undefined,
        filter: filter === "all" ? undefined : filter,
        page,
        pageSize: PAGE_SIZE,
      }),
    [book, filter, appliedSearch, page],
  );
  const dreams = data?.items ?? [];
  // Rows that stop matching (a name filled in elsewhere) can leave a later
  // page empty: step back to the last page that has rows.
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const changeBook = (next: LotteryDreamBook) => {
    setBook(next);
    setPage(1);
  };

  const changeFilter = (next: LotteryDreamFilter) => {
    setFilter(next);
    setPage(1);
  };

  const [editing, setEditing] = useState<LotteryDream | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importKey, setImportKey] = useState(0);
  const [picturesOpen, setPicturesOpen] = useState(false);
  const [picturesKey, setPicturesKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const openImport = () => {
    setImportKey((k) => k + 1);
    setImportOpen(true);
  };

  const openPictures = () => {
    setPicturesKey((k) => k + 1);
    setPicturesOpen(true);
  };

  // Refetch rather than patch the row in place: the row may no longer match
  // the filter tab it was opened from ("Missing name" after a name is given).
  const handleSaved = () => refetch();

  const handleExport = async () => {
    setExporting(true);
    try {
      saveBlob(await lotteryService.exportDreams(book), exportFileName(book));
    } catch (err) {
      toast.error(d.exportFailedToast, { description: dreamErrorMessage(err, t) });
    } finally {
      setExporting(false);
    }
  };

  const columns = getDreamColumns({ t, canManage, onEdit: setEditing });

  const isFiltered = !!appliedSearch || filter !== "all";

  const actions = (
    <>
      <Button variant="outline" onClick={handleExport} disabled={exporting}>
        <Download className="size-4" />
        {exporting ? d.exporting : d.export}
      </Button>
      {canManage && (
        <>
          <Button variant="outline" onClick={openPictures}>
            <Images className="size-4" />
            {d.pictures.open}
          </Button>
          <Button onClick={openImport}>
            <FileUp className="size-4" />
            {d.import.open}
          </Button>
        </>
      )}
    </>
  );

  return (
    <div>
      <PageHeader title={d.title} description={d.description} actions={actions} />
      {!canManage && <p className="-mt-3 mb-4 text-sm text-muted-foreground">{d.readOnly}</p>}

      <Tabs value={book} onValueChange={(value) => value && changeBook(value as LotteryDreamBook)} className="mb-4">
        <TabsList>
          {LOTTERY_DREAM_BOOKS.map((value) => (
            <TabsTrigger key={value} value={value} className="px-3">
              {d.books[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{d.bookHelp[book]}</p>

      {error ? (
        <ErrorState description={d.loadError} onRetry={refetch} />
      ) : !isLoading && dreams.length === 0 && !isFiltered && page === 1 ? (
        // The rows are created with the lottery tables, so an empty book means
        // the backend has not been set up yet — not that nothing matched.
        <EmptyState icon={Sparkles} title={d.emptyTitle} description={d.emptyDescription} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={dreams}
            isLoading={isLoading}
            pageSize={PAGE_SIZE}
            manualPagination
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={d.searchPlaceholder}
            toolbar={<DreamFilterTabs value={filter} onValueChange={changeFilter} />}
            emptyState={<p className="text-sm text-muted-foreground">{d.noMatches[filter]}</p>}
          />
          {!isLoading && data && (
            <ServerPagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          )}
        </>
      )}

      {canManage && editing && (
        <DreamEditDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          dream={editing}
          onSaved={handleSaved}
        />
      )}

      {canManage && importOpen && (
        <DreamImportDialog
          key={importKey}
          open={importOpen}
          onOpenChange={setImportOpen}
          onExport={handleExport}
          exporting={exporting}
          onApplied={refetch}
        />
      )}

      {canManage && picturesOpen && (
        <DreamPicturesImportDialog
          key={picturesKey}
          open={picturesOpen}
          onOpenChange={setPicturesOpen}
          book={book}
          onApplied={refetch}
        />
      )}
    </div>
  );
}

export default function LotteryDreamsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="LOTTERY.VIEW" title={t.lottery.dreams.title} description={t.lottery.dreams.description}>
      <DreamsContent />
    </RequirePermission>
  );
}
