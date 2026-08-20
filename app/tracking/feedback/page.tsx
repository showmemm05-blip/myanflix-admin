"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  MessageSquareWarning,
  RotateCw,
  Search as SearchIcon,
  XCircle,
} from "lucide-react";
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
import {
  DateRangeFilter,
  type DateRangeValue,
} from "@/components/shared/DateRangeFilter";
import { DataTable } from "@/components/tables/DataTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { MaskedPiiNotice } from "@/components/tracking/MaskedPiiNotice";
import { FeedbackDetailsDialog } from "@/components/tracking/FeedbackDetailsDialog";
import { getFeedbackColumns } from "@/components/tracking/feedbackColumns";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { trackingService } from "@/services/api/trackingService";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  type TrackedFeedback,
} from "@/types/tracking";

/**
 * `DateRangeFilter` emits a LOCAL calendar date; the API takes an instant.
 * Sending the local day's own boundaries keeps the operator's chosen day from
 * sliding by the UTC offset.
 */
function startOfDayIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}
function endOfDayIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString();
}

const PAGE_LIMIT = 100;
const COUNT_ONLY = 1;

export default function TrackingFeedbackPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canManage = can("TRACKING.FEEDBACK_MANAGE");
  const canViewPii = can("TRACKING.PII_VIEW");
  const f = t.tracking.feedback;

  // A triage queue opens on everything outstanding, not on today.
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      trackingService.getFeedback({
        limit: PAGE_LIMIT,
        from: range.from ? startOfDayIso(range.from) : undefined,
        to: range.to ? endOfDayIso(range.to) : undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        search: appliedSearch || undefined,
      }),
    [range, statusFilter, categoryFilter, appliedSearch],
  );

  /**
   * One SERVER count per status, plus the total. Counting the loaded page
   * instead would make the queue look emptier than it is the moment there
   * are more than 100 rows — exactly when the counts start to matter.
   */
  const {
    data: cards,
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useAsyncData(async () => {
    const [all, isNew, inReview, resolved, dismissed] = await Promise.all([
      trackingService.getFeedback({ limit: COUNT_ONLY }),
      trackingService.getFeedback({ limit: COUNT_ONLY, status: "NEW" }),
      trackingService.getFeedback({ limit: COUNT_ONLY, status: "IN_REVIEW" }),
      trackingService.getFeedback({ limit: COUNT_ONLY, status: "RESOLVED" }),
      trackingService.getFeedback({ limit: COUNT_ONLY, status: "DISMISSED" }),
    ]);
    return {
      total: all.total,
      new: isNew.total,
      inReview: inReview.total,
      resolved: resolved.total,
      dismissed: dismissed.total,
    };
  }, []);

  const [rows, setRows] = useState<TrackedFeedback[] | null>(null);
  const activeRows = rows ?? data?.items ?? [];
  const [detailsTarget, setDetailsTarget] = useState<TrackedFeedback | null>(null);

  const handleRangeChange = (next: DateRangeValue) => {
    setRows(null);
    setRange(next);
  };
  const handleStatusChange = (next: FeedbackStatus | "") => {
    setRows(null);
    setStatusFilter(next);
  };
  const handleCategoryChange = (next: FeedbackCategory | "") => {
    setRows(null);
    setCategoryFilter(next);
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

  const handleSaved = (updated: TrackedFeedback) => {
    setRows(activeRows.map((row) => (row.id === updated.id ? updated : row)));
    // The row just moved between two of the cards above.
    refetchCards();
    setDetailsTarget(null);
  };

  const columns = getFeedbackColumns({ t, onViewDetails: setDetailsTarget });

  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={{
          "": f.filters.statusAll,
          ...Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, f.status[s]])),
        }}
        value={statusFilter}
        onValueChange={(value) => handleStatusChange((value as FeedbackStatus | "") ?? "")}
      >
        <SelectTrigger size="sm" className="w-40" aria-label={f.filters.statusLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{f.filters.statusAll}</SelectItem>
          {FEEDBACK_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {f.status[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{
          "": f.filters.categoryAll,
          ...Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c, f.category[c]])),
        }}
        value={categoryFilter}
        onValueChange={(value) => handleCategoryChange((value as FeedbackCategory | "") ?? "")}
      >
        <SelectTrigger size="sm" className="w-40" aria-label={f.filters.categoryLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{f.filters.categoryAll}</SelectItem>
          {FEEDBACK_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {f.category[category]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangeFilter value={range} onChange={handleRangeChange} />
    </div>
  );

  const isFiltered =
    !!range.from || !!range.to || !!statusFilter || !!categoryFilter || !!search;

  return (
    <RequirePermission permission="TRACKING.VIEW" title={f.title} description={f.subtitle}>
      <div>
        <PageHeader
          title={f.title}
          description={f.subtitle}
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
                    title: f.cards.total,
                    hint: t.tracking.common.allTime,
                    value: cards.total,
                    icon: MessageSquareWarning,
                    iconClassName: "bg-info/15 text-info",
                  },
                  {
                    title: f.cards.new,
                    hint: f.cards.newHint,
                    value: cards.new,
                    icon: Inbox,
                    iconClassName: "bg-primary/15 text-primary",
                  },
                  {
                    title: f.cards.inReview,
                    hint: f.status.IN_REVIEW,
                    value: cards.inReview,
                    icon: SearchIcon,
                    iconClassName: "bg-warning/15 text-warning",
                  },
                  {
                    title: f.cards.resolved,
                    hint: f.status.RESOLVED,
                    value: cards.resolved,
                    icon: CheckCircle2,
                    iconClassName: "bg-success/15 text-success",
                  },
                  {
                    title: f.cards.dismissed,
                    hint: f.status.DISMISSED,
                    value: cards.dismissed,
                    icon: XCircle,
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

          {!canManage && (
            <p className="text-xs text-muted-foreground">{f.details.needsPermission}</p>
          )}

          {error ? (
            <ErrorState description={t.tracking.common.loadError} onRetry={handleRefresh} />
          ) : !isLoading && activeRows.length === 0 && !isFiltered ? (
            <EmptyState
              icon={MessageSquareWarning}
              title={f.empty.title}
              description={f.empty.description}
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeRows}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={handleSearchChange}
              searchPlaceholder={f.filters.searchPlaceholder}
              toolbar={tableToolbar}
            />
          )}
        </div>

        <FeedbackDetailsDialog
          feedback={detailsTarget}
          open={detailsTarget !== null}
          onOpenChange={(open) => !open && setDetailsTarget(null)}
          canManage={canManage}
          onSaved={handleSaved}
        />
      </div>
    </RequirePermission>
  );
}
