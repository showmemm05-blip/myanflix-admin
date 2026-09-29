"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/context/language-context";

/**
 * The "Showing x–y of z / Previous / Page n of m / Next" footer for a list
 * paged on the server (H-24) — the same footer the Audit log draws, fed by
 * the API's `total` instead of the rows the browser happens to hold. Pair it
 * with `<DataTable manualPagination />`.
 */
export function ServerPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLanguage();
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = Math.min((page - 1) * pageSize + 1, total);
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm tabular-nums text-muted-foreground">
        {t.shared.showingResults(firstRow, lastRow, total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, Math.min(page, totalPages + 1) - 1))}
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
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          {t.shared.next}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
