"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { getAuditColumns } from "@/components/audit/columns";
import {
  AuditFilters,
  EMPTY_AUDIT_FILTERS,
  type AuditFilterValues,
} from "@/components/audit/AuditFilters";
import { AuditDetailsDialog } from "@/components/audit/AuditDetailsDialog";
import { endOfDayIso, startOfDayIso } from "@/components/tracking/trackingFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { auditService } from "@/services/api/auditService";
import type { AuditCategory, AuditLogEntry, AuditQuery } from "@/types/audit";

/**
 * Rows per server page. The log only grows, so unlike the Tracking screens it
 * is paged on the server and DataTable's own client paging is switched off
 * (`pageSize` = the whole fetched page, footer replaced below).
 */
const PAGE_LIMIT = 25;

function AuditLogContent() {
  const { t } = useLanguage();
  const a = t.audit;

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilterValues>(EMPTY_AUDIT_FILTERS);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(filters.search.trim()), 300);
    return () => clearTimeout(handle);
  }, [filters.search]);

  // Any filter change restarts at page 1 — page N of a narrower result set
  // is usually past its end.
  const handleFiltersChange = (next: AuditFilterValues) => {
    setFilters(next);
    setPage(1);
  };

  const { data: catalogue } = useAsyncData(() => auditService.catalogue(), []);

  // Only DTO keys, and unused ones left `undefined` so apiClient drops them:
  // the backend answers 400 to any query param it does not know.
  const query: AuditQuery = {
    page,
    limit: PAGE_LIMIT,
    from: filters.range.from ? startOfDayIso(filters.range.from) : undefined,
    to: filters.range.to ? endOfDayIso(filters.range.to) : undefined,
    category: (filters.category || undefined) as AuditCategory | undefined,
    action: filters.action || undefined,
    targetType: filters.targetType || undefined,
    search: appliedSearch || undefined,
  };

  const { data, isLoading, error, refetch } = useAsyncData(
    () => auditService.list(query),
    [page, filters.range, filters.category, filters.action, filters.targetType, appliedSearch],
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const lastRow = Math.min(page * PAGE_LIMIT, total);

  const isFiltered =
    !!filters.range.from ||
    !!filters.range.to ||
    !!filters.category ||
    !!filters.action ||
    !!filters.targetType ||
    !!appliedSearch;

  const columns = getAuditColumns({ t, onViewDetails: setDetailsTarget });

  return (
    <div>
      <PageHeader
        title={a.title}
        description={a.subtitle}
        actions={
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RotateCw className="size-4" />
            {isLoading ? a.refreshing : a.refresh}
          </Button>
        }
      />

      <div className="mb-4">
        <AuditFilters value={filters} onChange={handleFiltersChange} catalogue={catalogue} t={t} />
      </div>

      {error ? (
        <ErrorState description={a.loadError} onRetry={refetch} />
      ) : !isLoading && rows.length === 0 && !isFiltered ? (
        <EmptyState icon={ScrollText} title={a.empty.title} description={a.empty.description} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            pageSize={PAGE_LIMIT}
            hideFooter
          />
          {!isLoading && total > 0 && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm tabular-nums text-muted-foreground">
                {t.shared.showingResults(firstRow, lastRow, total)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  {t.shared.previous}
                </Button>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {t.shared.pageOf(page, totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  {t.shared.next}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AuditDetailsDialog
        entry={detailsTarget}
        open={detailsTarget !== null}
        onOpenChange={(open) => !open && setDetailsTarget(null)}
      />
    </div>
  );
}

export default function AuditLogPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="AUDIT.VIEW" title={t.audit.title} description={t.audit.subtitle}>
      <AuditLogContent />
    </RequirePermission>
  );
}
