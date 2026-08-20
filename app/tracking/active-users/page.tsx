"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Globe, Radio, RotateCw, Smartphone, Users } from "lucide-react";
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
import { DataTable } from "@/components/tables/DataTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { MaskedPiiNotice } from "@/components/tracking/MaskedPiiNotice";
import { getActiveUserColumns } from "@/components/tracking/activeUserColumns";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { trackingService } from "@/services/api/trackingService";
import { CLIENT_PLATFORMS, type ActiveUsersResponse, type ClientPlatform } from "@/types/tracking";

/** Comfortably inside the server's 5-minute presence window, cheap enough to leave running. */
const POLL_MS = 15_000;

const PAGE_LIMIT = 100;

/** A response plus when this browser received it — the source of the "updated" stamp. */
interface Snapshot {
  report: ActiveUsersResponse;
  at: Date;
}

export default function TrackingActiveUsersPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canView = can("TRACKING.VIEW");
  const canViewPii = can("TRACKING.PII_VIEW");
  const a = t.tracking.activeUsers;

  // No date range: "active" is the server's 5-minute window, not a period an
  // operator picks — and `ActiveUsersQuery` has no from/to to send.
  const [platform, setPlatform] = useState<ClientPlatform | "">("");

  const { data, isLoading, error, refetch } = useAsyncData<Snapshot>(async () => {
    const report = await trackingService.getActiveUsers({
      limit: PAGE_LIMIT,
      platform: platform || undefined,
    });
    return { report, at: new Date() };
  }, [platform]);

  /**
   * Poll results live here rather than going back through `useAsyncData`,
   * whose refetch flips `isLoading` — which would replace the table with
   * skeletons every 15 seconds. A live list must not blink.
   */
  const [polled, setPolled] = useState<Snapshot | null>(null);
  const current = polled ?? data;

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void trackingService
        .getActiveUsers({ limit: PAGE_LIMIT, platform: platform || undefined })
        .then((report) => {
          if (!cancelled) setPolled({ report, at: new Date() });
        })
        .catch(() => {
          // A dropped poll is not an error state — the last good list stays on
          // screen and the next tick, 15s away, corrects it.
        });
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [canView, platform]);

  const handlePlatformChange = (next: ClientPlatform | "") => {
    // Drop the polled override so the refetch for the new filter isn't masked
    // by the previous filter's rows.
    setPolled(null);
    setPlatform(next);
  };

  const handleRefresh = () => {
    setPolled(null);
    refetch();
  };

  const columns = getActiveUserColumns({ t });

  const tableToolbar = (
    <Select
      items={{
        "": t.tracking.platform.all,
        ...Object.fromEntries(CLIENT_PLATFORMS.map((p) => [p, t.tracking.platform[p]])),
      }}
      value={platform}
      onValueChange={(value) => handlePlatformChange((value as ClientPlatform | "") ?? "")}
    >
      <SelectTrigger size="sm" className="w-44" aria-label={a.filters.platformLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{a.filters.platformAll}</SelectItem>
        {CLIENT_PLATFORMS.map((value) => (
          <SelectItem key={value} value={value}>
            {t.tracking.platform[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const rows = current?.report.items ?? [];
  /**
   * The cards come from `summary`, which describes the WHOLE active set even
   * when `platform` narrows the rows — recomputing them from `items` would
   * report one filtered page as if it were everyone. `web + mobile` can
   * legitimately exceed `total`; `overlapHint` below is why.
   */
  const summary = current?.report.summary;

  const summaryCards = summary
    ? [
        {
          title: a.cards.total,
          value: summary.total,
          icon: Users,
          iconClassName: "bg-success/15 text-success",
        },
        {
          title: a.cards.web,
          value: summary.web,
          icon: Globe,
          iconClassName: "bg-chart-2/15 text-chart-2",
        },
        {
          title: a.cards.mobile,
          value: summary.mobile,
          icon: Smartphone,
          iconClassName: "bg-chart-3/15 text-chart-3",
        },
      ]
    : null;

  return (
    <RequirePermission permission="TRACKING.VIEW" title={a.title} description={a.subtitle}>
      <div>
        <PageHeader
          title={a.title}
          description={a.subtitle}
          actions={
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
                title={t.tracking.common.autoRefresh}
              >
                <span className="size-1.5 animate-pulse rounded-full bg-success" />
                {t.tracking.common.live}
                {current && <span>· {t.tracking.common.lastUpdated(format(current.at, "HH:mm:ss"))}</span>}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                <RotateCw className="size-4" />
                {isLoading ? t.tracking.common.refreshing : t.tracking.common.refresh}
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-6">
          <MaskedPiiNotice canViewPii={canViewPii} />

          {/* An error takes over the page only while there is nothing to show:
              once a poll has succeeded, a later failed one must not blank out
              the list the operator is watching. */}
          {error && !current ? (
            <ErrorState description={t.tracking.common.loadError} onRetry={handleRefresh} />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {summaryCards
                    ? summaryCards.map((card) => (
                        <DashboardCard
                          key={card.title}
                          title={card.title}
                          value={card.value.toLocaleString()}
                          icon={card.icon}
                          iconClassName={card.iconClassName}
                        />
                      ))
                    : Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-[92px] rounded-xl bg-secondary/60" />
                      ))}
                </div>
                {/* The two sentences that stop the three cards looking wrong:
                    what "active" means, and why the platform cards can out-sum
                    the total. */}
                <p className="px-1 text-[11px] text-muted-foreground">
                  {a.cards.totalHint} · {a.windowNote} {a.cards.overlapHint}
                </p>
              </div>

              {!isLoading && rows.length === 0 && !platform ? (
                <EmptyState icon={Radio} title={a.empty.title} description={a.empty.description} />
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  isLoading={isLoading}
                  // The list is short and live; a page break would shuffle
                  // under the operator on every poll.
                  pageSize={25}
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
