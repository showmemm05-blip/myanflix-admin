"use client";

import { useEffect, useState } from "react";
import { Hash, RotateCw, Search, SearchX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { DataTable } from "@/components/tables/DataTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { PlatformFilter } from "@/components/tracking/PlatformFilter";
import { TopSearchTermsChart } from "@/components/tracking/TopSearchTermsChart";
import {
  getRecentSearchColumns,
  getTopSearchColumns,
} from "@/components/tracking/searchColumns";
import { endOfDayIso, startOfDayIso } from "@/components/tracking/trackingFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { trackingService } from "@/services/api/trackingService";
import type { ClientPlatform } from "@/types/tracking";

/** Rows per fetch — DataTable pages through them client-side, as everywhere else. */
const PAGE_LIMIT = 100;

type SearchTab = "top" | "recent";

export default function TrackingSearchesPage() {
  const { t } = useLanguage();
  const s = t.tracking.searches;

  // All dates by default: demand for a title people can't find is worth
  // seeing whether it was typed this morning or last month.
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [platform, setPlatform] = useState<ClientPlatform | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tab, setTab] = useState<SearchTab>("top");

  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const query = {
    limit: PAGE_LIMIT,
    from: range.from ? startOfDayIso(range.from) : undefined,
    to: range.to ? endOfDayIso(range.to) : undefined,
    platform: platform || undefined,
    search: appliedSearch || undefined,
  };

  /**
   * Both views are fetched for every filter change, not just the visible one.
   *
   * Two reasons: switching tabs is then instant rather than a fresh spinner,
   * and the "Searches" card needs the RAW log's total — the grouped report's
   * `total` counts distinct terms, which is the *other* card. One request per
   * view is also what makes both numbers exact server counts instead of
   * tallies of a loaded page.
   */
  const {
    data: top,
    isLoading: topLoading,
    error: topError,
    refetch: refetchTop,
  } = useAsyncData(() => trackingService.getTopSearches(query), [range, platform, appliedSearch]);

  const {
    data: recent,
    isLoading: recentLoading,
    error: recentError,
    refetch: refetchRecent,
  } = useAsyncData(
    () => trackingService.getRecentSearches(query),
    [range, platform, appliedSearch],
  );

  const handleRefresh = () => {
    refetchTop();
    refetchRecent();
  };

  const isLoading = topLoading || recentLoading;
  const error = topError ?? recentError;
  const isFiltered = !!range.from || !!range.to || !!platform || !!search;

  const topRows = top?.items ?? [];
  const recentRows = recent?.items ?? [];

  /**
   * Dead ends are counted over the terms actually loaded — there is no
   * server-side "terms that returned nothing" count, and inventing one by
   * extrapolation is exactly what this section must never do.
   *
   * With `limit: 100` and terms ordered by how often they were typed, this
   * is the whole set whenever there are 100 or fewer distinct terms in the
   * window, and otherwise reads as "how many of the 100 most-searched terms
   * come back empty" — which is the more useful number of the two anyway.
   */
  const deadEnds = topRows.filter((term) => term.avgResults <= 0).length;

  const cards = [
    {
      key: "totalSearches",
      title: s.cards.totalSearches,
      hint: s.cards.totalSearchesHint,
      value: (recent?.total ?? 0).toLocaleString(),
      icon: Search,
      iconClassName: "bg-primary/15 text-primary",
    },
    {
      key: "uniqueTerms",
      title: s.cards.uniqueTerms,
      hint: s.cards.uniqueTermsHint,
      value: (top?.total ?? 0).toLocaleString(),
      icon: Hash,
      iconClassName: "bg-info/15 text-info",
    },
    {
      key: "deadEnds",
      title: s.cards.deadEnds,
      hint: s.cards.deadEndsHint,
      value: deadEnds.toLocaleString(),
      icon: SearchX,
      iconClassName: "bg-warning/15 text-warning",
    },
  ];

  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <PlatformFilter
        value={platform}
        onChange={setPlatform}
        label={s.filters.platformLabel}
        allLabel={s.filters.platformAll}
      />
      <DateRangeFilter value={range} onChange={setRange} />
    </div>
  );

  return (
    <RequirePermission permission="TRACKING.VIEW" title={s.title} description={s.subtitle}>
      <div>
        <PageHeader
          title={s.title}
          description={s.subtitle}
          actions={
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RotateCw className="size-4" />
              {isLoading ? t.tracking.common.refreshing : t.tracking.common.refresh}
            </Button>
          }
        />

        <div className="flex flex-col gap-6">
          {/* The one misreading this page has to prevent: these are words
              people TYPED, not titles they watched. Said in the subtitle and
              again here, where a reader is about to interpret a chart. */}
          <Alert>
            <Search />
            <AlertTitle>{s.typedTextNote}</AlertTitle>
            <AlertDescription>{s.staffExcludedNote}</AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {isLoading && !top
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl bg-secondary/60" />
                ))
              : cards.map((card) => (
                  <div key={card.key} className="flex flex-col gap-1">
                    <DashboardCard
                      title={card.title}
                      value={card.value}
                      icon={card.icon}
                      iconClassName={card.iconClassName}
                    />
                    <p className="px-1 text-[11px] text-muted-foreground">{card.hint}</p>
                  </div>
                ))}
          </div>

          {error ? (
            <ErrorState description={t.tracking.common.loadError} onRetry={handleRefresh} />
          ) : (
            <>
              <Tabs value={tab} onValueChange={(value) => value && setTab(value as SearchTab)}>
                <TabsList>
                  <TabsTrigger value="top">{s.tabs.top}</TabsTrigger>
                  <TabsTrigger value="recent">{s.tabs.recent}</TabsTrigger>
                </TabsList>
              </Tabs>

              {tab === "top" ? (
                <>
                  {/* Only drawn when there is something to draw — an empty
                      chart frame reads as a broken chart. */}
                  {topRows.length > 0 && <TopSearchTermsChart terms={topRows} />}

                  {!topLoading && topRows.length === 0 && !isFiltered ? (
                    <EmptyState
                      icon={Search}
                      title={s.empty.topTitle}
                      description={s.empty.topDescription}
                    />
                  ) : (
                    <DataTable
                      columns={getTopSearchColumns({ t })}
                      data={topRows}
                      isLoading={topLoading}
                      searchValue={search}
                      onSearchChange={setSearch}
                      searchPlaceholder={s.filters.searchPlaceholder}
                      toolbar={tableToolbar}
                    />
                  )}
                </>
              ) : !recentLoading && recentRows.length === 0 && !isFiltered ? (
                <EmptyState
                  icon={Search}
                  title={s.empty.recentTitle}
                  description={s.empty.recentDescription}
                />
              ) : (
                <DataTable
                  columns={getRecentSearchColumns({ t })}
                  data={recentRows}
                  isLoading={recentLoading}
                  searchValue={search}
                  onSearchChange={setSearch}
                  searchPlaceholder={s.filters.searchPlaceholder}
                  toolbar={tableToolbar}
                />
              )}
            </>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
