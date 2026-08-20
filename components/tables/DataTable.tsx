"use client";

import { useState, type ReactNode } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  /**
   * Server-driven search. When `onSearchChange` is supplied the box becomes a
   * controlled input and the client-side column filter is bypassed entirely —
   * the caller queries the API instead of filtering only the loaded page. Use
   * it wherever the backend can search fields the table doesn't carry.
   */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Rendered immediately beside the search input (e.g. a primary action button). */
  searchActions?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  isLoading?: boolean;
  emptyState?: ReactNode;
  /** Extra classes per row — used to tint rows by category (e.g. transaction type). */
  rowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchActions,
  toolbar,
  pageSize = 10,
  isLoading = false,
  emptyState,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const { t } = useLanguage();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    state: { sorting, columnFilters },
  });

  const rows = table.getRowModel().rows;

  // A caller that owns the search term drives the API; otherwise the box
  // filters the single `searchKey` column client-side, as it always has.
  const serverSearch = !!onSearchChange;
  const showSearch = serverSearch || !!searchKey;

  return (
    <div className="flex flex-col gap-4">
      {(showSearch || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showSearch && (
            // With a toolbar occupying the right side, the actions hug the
            // search box; without one, they spread to the far edge instead.
            <div
              className={cn(
                "flex w-full items-center gap-2",
                toolbar ? "sm:w-auto" : "justify-between",
              )}
            >
              {/* w-80 = the old max-w-xs footprint, now fixed so the action
                  button beside it sits at a stable position. */}
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder ?? t.shared.searchPlaceholder}
                  value={
                    serverSearch
                      ? searchValue ?? ""
                      : (searchKey ? (table.getColumn(searchKey)?.getFilterValue() as string) : "") ?? ""
                  }
                  onChange={(e) =>
                    serverSearch
                      ? onSearchChange(e.target.value)
                      : searchKey && table.getColumn(searchKey)?.setFilterValue(e.target.value)
                  }
                  className="bg-secondary/50 pl-9"
                />
              </div>
              {searchActions}
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="glass-card overflow-hidden rounded-xl">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} className="h-11 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === "asc" && <ArrowUp className="size-3.5" />}
                          {sortDirection === "desc" && <ArrowDown className="size-3.5" />}
                          {!sortDirection && <ArrowUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-4 py-3">
                      <Skeleton className="h-5 w-full max-w-32 bg-secondary/60" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id} className={cn("border-border", rowClassName?.(row.original))}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  {emptyState ?? (
                    <p className="text-sm text-muted-foreground">{t.shared.noResultsFound}</p>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && rows.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm tabular-nums text-muted-foreground">
            {t.shared.showingResults(
              table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1,
              Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              ),
              table.getFilteredRowModel().rows.length
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4" />
              {t.shared.previous}
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {t.shared.pageOf(table.getState().pagination.pageIndex + 1, Math.max(table.getPageCount(), 1))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t.shared.next}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
