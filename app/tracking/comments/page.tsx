"use client";

import { useEffect, useState } from "react";
import { CalendarDays, EyeOff, Globe, MessageSquare, RotateCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DateRangeFilter,
  todayStr,
  type DateRangeValue,
} from "@/components/shared/DateRangeFilter";
import { DataTable } from "@/components/tables/DataTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { MaskedPiiNotice } from "@/components/tracking/MaskedPiiNotice";
import { CommentDetailsDialog } from "@/components/tracking/CommentDetailsDialog";
import { getCommentColumns } from "@/components/tracking/commentColumns";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { trackingService } from "@/services/api/trackingService";
import { COMMENT_STATUSES, type CommentStatus, type TrackedComment } from "@/types/tracking";

/**
 * `DateRangeFilter` emits a LOCAL calendar date; the API takes an instant.
 * A bare "2026-08-20" would be read as UTC midnight, so in Myanmar's +06:30
 * the operator's chosen day would start at 06:30 and run into the next one.
 * Sending the local day's own boundaries makes the picked day the picked day.
 */
function startOfDayIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}
function endOfDayIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString();
}

/** How many rows to pull per fetch — DataTable pages through them client-side. */
const PAGE_LIMIT = 100;

/** A count query: one row asked for, only `total` used. */
const COUNT_ONLY = 1;

export default function TrackingCommentsPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canModerate = can("TRACKING.COMMENTS_MODERATE");
  const canViewPii = can("TRACKING.PII_VIEW");
  const c = t.tracking.comments;

  // Unbounded by default: this is a moderation queue, and a queue that opens
  // on "today" hides the week-old comment somebody just reported.
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [statusFilter, setStatusFilter] = useState<CommentStatus | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      trackingService.getComments({
        limit: PAGE_LIMIT,
        from: range.from ? startOfDayIso(range.from) : undefined,
        to: range.to ? endOfDayIso(range.to) : undefined,
        status: statusFilter || undefined,
        search: appliedSearch || undefined,
      }),
    [range, statusFilter, appliedSearch],
  );

  /**
   * The five cards are SERVER counts, not a tally of the loaded page — a page
   * is 100 rows of a filtered list and would quietly under-report every one
   * of them. They describe the whole corpus, all time, and deliberately do
   * not move when the table below is filtered.
   */
  const {
    data: cards,
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useAsyncData(async () => {
    const today = todayStr();
    const [all, todayCount, web, mobile, hidden] = await Promise.all([
      trackingService.getComments({ limit: COUNT_ONLY }),
      trackingService.getComments({
        limit: COUNT_ONLY,
        from: startOfDayIso(today),
        to: endOfDayIso(today),
      }),
      trackingService.getComments({ limit: COUNT_ONLY, platform: "WEB" }),
      trackingService.getComments({ limit: COUNT_ONLY, platform: "MOBILE" }),
      trackingService.getComments({ limit: COUNT_ONLY, status: "HIDDEN" }),
    ]);
    return {
      total: all.total,
      today: todayCount.total,
      web: web.total,
      mobile: mobile.total,
      hidden: hidden.total,
    };
  }, []);

  // Local override for rows this page has just acted on, so a hide reflects
  // instantly without waiting for a round trip. Dropped whenever the query
  // changes, or the refetched rows would be masked by the stale list.
  const [rows, setRows] = useState<TrackedComment[] | null>(null);
  const activeRows = rows ?? data?.items ?? [];

  const [detailsTarget, setDetailsTarget] = useState<TrackedComment | null>(null);
  const [moderateTarget, setModerateTarget] = useState<TrackedComment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrackedComment | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleRangeChange = (next: DateRangeValue) => {
    setRows(null);
    setRange(next);
  };
  const handleStatusChange = (next: CommentStatus | "") => {
    setRows(null);
    setStatusFilter(next);
  };
  const handleSearchChange = (value: string) => {
    setRows(null);
    setSearch(value);
  };
  const handleRefresh = () => {
    setRows(null);
    refetch();
    refetchCards();
  };

  const handleModerate = async () => {
    if (!moderateTarget) return;
    const next: CommentStatus = moderateTarget.status === "HIDDEN" ? "VISIBLE" : "HIDDEN";
    setPendingId(moderateTarget.id);
    try {
      const updated = await trackingService.moderateComment(moderateTarget.id, next);
      setRows(
        activeRows.map((row) =>
          row.id === updated.id ? { ...row, status: updated.status } : row,
        ),
      );
      toast.success(next === "HIDDEN" ? c.toast.hidden : c.toast.restored);
      // The Hidden card is the one this just changed.
      refetchCards();
      setModerateTarget(null);
    } catch (err) {
      toast.error(c.toast.failed, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    try {
      await trackingService.deleteComment(deleteTarget.id);
      setRows(activeRows.filter((row) => row.id !== deleteTarget.id));
      toast.success(c.toast.deleted);
      refetchCards();
      setDeleteTarget(null);
      // The row is gone; a details dialog still showing it would be a ghost.
      setDetailsTarget((current) => (current?.id === deleteTarget.id ? null : current));
    } catch (err) {
      toast.error(c.toast.failed, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPendingId(null);
    }
  };

  const columns = getCommentColumns({
    t,
    canModerate,
    onViewDetails: setDetailsTarget,
    onToggleStatus: setModerateTarget,
    onDelete: setDeleteTarget,
    pendingId,
  });

  // Mounted across loading and loaded alike, so changing a filter never
  // unmounts the control being used.
  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={{
          "": c.filters.statusAll,
          ...Object.fromEntries(COMMENT_STATUSES.map((s) => [s, c.status[s]])),
        }}
        value={statusFilter}
        onValueChange={(value) => handleStatusChange((value as CommentStatus | "") ?? "")}
      >
        <SelectTrigger size="sm" className="w-40" aria-label={c.filters.statusLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{c.filters.statusAll}</SelectItem>
          {COMMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {c.status[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DateRangeFilter value={range} onChange={handleRangeChange} />
    </div>
  );

  const isFiltered = !!range.from || !!range.to || !!statusFilter || !!search;

  return (
    <RequirePermission permission="TRACKING.VIEW" title={c.title} description={c.subtitle}>
      <div>
        <PageHeader
          title={c.title}
          description={c.subtitle}
          actions={
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RotateCw className="size-4" />
              {isLoading ? t.tracking.common.refreshing : t.tracking.common.refresh}
            </Button>
          }
        />

        <div className="flex flex-col gap-6">
          <MaskedPiiNotice canViewPii={canViewPii} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cardsLoading || !cards
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl bg-secondary/60" />
                ))
              : [
                  {
                    title: c.cards.total,
                    hint: c.cards.totalHint,
                    value: cards.total,
                    icon: MessageSquare,
                    iconClassName: "bg-info/15 text-info",
                  },
                  {
                    title: c.cards.today,
                    hint: c.cards.todayHint,
                    value: cards.today,
                    icon: CalendarDays,
                    iconClassName: "bg-primary/15 text-primary",
                  },
                  {
                    title: c.cards.web,
                    hint: t.tracking.platform.WEB,
                    value: cards.web,
                    icon: Globe,
                    iconClassName: "bg-chart-2/15 text-chart-2",
                  },
                  {
                    title: c.cards.mobile,
                    hint: t.tracking.platform.MOBILE,
                    value: cards.mobile,
                    icon: Smartphone,
                    iconClassName: "bg-chart-3/15 text-chart-3",
                  },
                  {
                    title: c.cards.hidden,
                    hint: c.cards.hiddenHint,
                    value: cards.hidden,
                    icon: EyeOff,
                    iconClassName: "bg-muted-foreground/15 text-muted-foreground",
                  },
                ].map((card) => (
                  <div key={card.title} className="flex flex-col gap-1">
                    <DashboardCard
                      title={card.title}
                      value={card.value.toLocaleString()}
                      icon={card.icon}
                      iconClassName={card.iconClassName}
                    />
                    <p className="px-1 text-[11px] text-muted-foreground">{card.hint}</p>
                  </div>
                ))}
          </div>

          {!canModerate && (
            // Said once, plainly, instead of leaving a reviewer to wonder why
            // there is no way to act on anything here.
            <p className="text-xs text-muted-foreground">{c.actions.needsPermission}</p>
          )}

          {error ? (
            <ErrorState description={t.tracking.common.loadError} onRetry={handleRefresh} />
          ) : !isLoading && activeRows.length === 0 && !isFiltered ? (
            // Full-page empty state only when nothing is filtered — with a
            // filter on, the table and its toolbar must stay mounted so the
            // filter can be undone.
            <EmptyState
              icon={MessageSquare}
              title={c.empty.title}
              description={c.empty.description}
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeRows}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={handleSearchChange}
              searchPlaceholder={c.filters.searchPlaceholder}
              toolbar={tableToolbar}
            />
          )}
        </div>

        <CommentDetailsDialog
          comment={detailsTarget}
          open={detailsTarget !== null}
          onOpenChange={(open) => !open && setDetailsTarget(null)}
        />

        <ConfirmDialog
          open={moderateTarget !== null}
          onOpenChange={(open) => !open && setModerateTarget(null)}
          title={
            moderateTarget?.status === "HIDDEN" ? c.restoreDialog.title : c.hideDialog.title
          }
          description={
            moderateTarget?.status === "HIDDEN"
              ? c.restoreDialog.description
              : c.hideDialog.description
          }
          confirmLabel={
            moderateTarget?.status === "HIDDEN"
              ? c.restoreDialog.confirm
              : c.hideDialog.confirm
          }
          loading={pendingId !== null && pendingId === moderateTarget?.id}
          onConfirm={handleModerate}
        />

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={c.deleteDialog.title}
          description={c.deleteDialog.description}
          confirmLabel={c.deleteDialog.confirm}
          variant="destructive"
          loading={pendingId !== null && pendingId === deleteTarget?.id}
          onConfirm={handleDelete}
        />
      </div>
    </RequirePermission>
  );
}
