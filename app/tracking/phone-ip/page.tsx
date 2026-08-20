"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Network, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { DataTable } from "@/components/tables/DataTable";
import { MaskedPiiNotice } from "@/components/tracking/MaskedPiiNotice";
import { PlatformFilter } from "@/components/tracking/PlatformFilter";
import { UserSessionsDrawer } from "@/components/tracking/UserSessionsDrawer";
import { getSessionColumns } from "@/components/tracking/sessionColumns";
import { endOfDayIso, startOfDayIso } from "@/components/tracking/trackingFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { trackingService } from "@/services/api/trackingService";
import type { ClientPlatform, UserSessionSummary } from "@/types/tracking";

/** Rows per fetch — DataTable pages through them client-side. */
const PAGE_LIMIT = 100;

export default function TrackingPhoneIpPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canViewPii = can("TRACKING.PII_VIEW");
  const p = t.tracking.phoneIp;

  // All dates by default: this is a record of who an account is, not a feed.
  // Narrowing to today would hide every account that hasn't signed in since.
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [platform, setPlatform] = useState<ClientPlatform | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  /**
   * Phone and IP are typed and then submitted, not debounced.
   *
   * A partial IP matches by `contains` server-side, so every keystroke of
   * "203.0.113.7" would run five queries whose results are each a superset
   * of the next — noise the operator has to watch scroll past. Free-text
   * search stays debounced because a partial name is a useful result.
   */
  const [phoneDraft, setPhoneDraft] = useState("");
  const [ipDraft, setIpDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [ip, setIp] = useState("");

  const [drawerTarget, setDrawerTarget] = useState<UserSessionSummary | null>(null);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      trackingService.getSessions({
        limit: PAGE_LIMIT,
        from: range.from ? startOfDayIso(range.from) : undefined,
        to: range.to ? endOfDayIso(range.to) : undefined,
        platform: platform || undefined,
        search: appliedSearch || undefined,
        phone: phone || undefined,
        ip: ip || undefined,
      }),
    [range, platform, appliedSearch, phone, ip],
  );

  const applyIdentifiers = (event: FormEvent) => {
    event.preventDefault();
    setPhone(phoneDraft.trim());
    setIp(ipDraft.trim());
  };

  const clearIdentifiers = () => {
    setPhoneDraft("");
    setIpDraft("");
    setPhone("");
    setIp("");
  };

  /**
   * The answer to "who else is on this address?" — one click on a flagged IP
   * pins the table to it. The draft field is set too, so the filter that is
   * now in force is visible and editable rather than a state the operator
   * has to guess at.
   */
  const filterByIp = (address: string) => {
    setIpDraft(address);
    setIp(address);
  };

  const rows = data?.items ?? [];
  const columns = getSessionColumns({
    t,
    canViewPii,
    onViewSessions: setDrawerTarget,
    onFilterByIp: filterByIp,
  });

  const isFiltered = !!range.from || !!range.to || !!platform || !!search || !!phone || !!ip;

  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <PlatformFilter
        value={platform}
        onChange={setPlatform}
        label={p.filters.platformLabel}
        allLabel={p.filters.platformAll}
      />
      <DateRangeFilter value={range} onChange={setRange} />
    </div>
  );

  return (
    <RequirePermission permission="TRACKING.VIEW" title={p.title} description={p.subtitle}>
      <div>
        <PageHeader
          title={p.title}
          description={p.subtitle}
          actions={
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              <RotateCw className="size-4" />
              {isLoading ? t.tracking.common.refreshing : t.tracking.common.refresh}
            </Button>
          }
        />

        <div className="flex flex-col gap-6">
          <MaskedPiiNotice canViewPii={canViewPii} />

          <form
            onSubmit={applyIdentifiers}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/40 p-3"
          >
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor="tracking-phone-filter" className="text-xs text-muted-foreground">
                {p.filters.phoneLabel}
              </Label>
              <Input
                id="tracking-phone-filter"
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(event.target.value)}
                placeholder={p.filters.phonePlaceholder}
                inputMode="tel"
              />
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor="tracking-ip-filter" className="text-xs text-muted-foreground">
                {p.filters.ipLabel}
              </Label>
              <Input
                id="tracking-ip-filter"
                value={ipDraft}
                onChange={(event) => setIpDraft(event.target.value)}
                placeholder={p.filters.ipPlaceholder}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                {p.filters.apply}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearIdentifiers}
                disabled={!phoneDraft && !ipDraft && !phone && !ip}
              >
                {p.filters.clear}
              </Button>
            </div>
          </form>

          {error ? (
            <ErrorState description={t.tracking.common.loadError} onRetry={refetch} />
          ) : !isLoading && rows.length === 0 && !isFiltered ? (
            <EmptyState icon={Network} title={p.empty.title} description={p.empty.description} />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={p.filters.searchPlaceholder}
              toolbar={tableToolbar}
              // A shared address is the thing this screen exists to surface,
              // so the whole row carries a tint — spotting one is a glance
              // down the table, not a hunt through a badge column.
              rowClassName={(row) => (row.sharedIp ? "bg-warning/[0.06]" : undefined)}
            />
          )}
        </div>

        <UserSessionsDrawer
          user={drawerTarget?.user ?? null}
          onOpenChange={(open) => !open && setDrawerTarget(null)}
        />
      </div>
    </RequirePermission>
  );
}
