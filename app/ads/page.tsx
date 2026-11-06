"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChartColumn, CircleHelp, Clapperboard, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { AdCardList } from "@/components/ads/AdCardList";
import { AdListToolbar, type AdStatusFilter, type AdTypeFilter } from "@/components/ads/AdListToolbar";
import { AdPreviewDialog } from "@/components/ads/AdPreviewDialog";
import { AD_SETTINGS_CARD_ID, AdSettingsCard } from "@/components/ads/AdSettingsCard";
import { HOW_ADS_WORK_ID, HowAdsWork, useHowAdsWorkOpen } from "@/components/ads/HowAdsWork";
import { WhyNotPlaying } from "@/components/ads/WhyNotPlaying";
import { AdWizard } from "@/components/ads/wizard/AdWizard";
import { getAdColumns } from "@/components/ads/columns";
import { adErrorMessage } from "@/components/ads/adForm";
import type { AdFix } from "@/components/ads/adHealth";
import type { AdStepId } from "@/components/ads/adSteps";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useNow } from "@/lib/hooks/use-now";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { ApiError } from "@/services/api/apiClient";
import { adService } from "@/services/api/adService";
import type { Ad, AdSettings } from "@/types/ad";

/** Rows per server page — the list is paged on the server, so every ad is reachable. */
const PAGE_LIMIT = 25;

/** How often the statuses re-read the clock — "Outside its hours" turns into "Showing" on its own. */
const STATUS_CLOCK_MS = 30_000;

/**
 * "Open Ad settings" waits this long before it focuses the card: the dialog
 * that asked for it closes first (a 100 ms exit), and the wizard, taken off
 * the page at once, can give focus back to the button that opened it —
 * which would otherwise scroll the page back to the row.
 */
const SETTINGS_JUMP_DELAY_MS = 300;

/** The Ad results page, linked under the table and, on phones, from the header. */
const AD_RESULTS_HREF = "/ads/analytics";

/** One copy of the Ad settings and when it was asked for (a read) or answered (a save) — the newer one wins. */
interface SettingsCopy {
  settings: AdSettings;
  at: number;
}

/**
 * The deep link into this page: `?ad=<id>` from the audit log opens that
 * ad. Read straight from window.location in a lazy initializer — the shell
 * never renders a page before the session is known, so there is no server
 * render to mismatch and no Suspense boundary to add.
 */
function readInitialAdId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ad")?.trim() || null;
}

/** Drops a query param from the address without a navigation (a reload must not reopen a dialog the admin closed). */
function dropQueryParam(name: string) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url.toString());
}

/**
 * "Advertisements" (2026-11-03; made plain 2026-11-04, the `Main` board,
 * docs/ads-admin-ux-2026-11-04): "How ads work" (open on the first visit),
 * the "Ad settings for all ads" card (closed, one summary sentence), one
 * toolbar, then the ads — a table on md and wider, cards on phones — each
 * with its VISIBLE status and the reason written under it (adHealth.ts: it
 * also knows the master switch, "ad breaks off" and the hours of the day),
 * a "Show to viewers" switch that says what it does, and "Will it show?",
 * which explains an ad that does not reach viewers and offers the fix.
 * New ads and edits go through the step-by-step wizard.
 *
 * ADS.VIEW reads, previews and asks "Will it show?"; ADS.MANAGE creates,
 * edits, switches, deletes and changes the settings; the backend audits
 * every change. The content lives under the permission gate (like the
 * audit page), so a staff member without ADS.VIEW never calls the ads API.
 */
function AdsContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canManage = can("ADS.MANAGE");
  const l = t.adsUi.list;
  const s = t.adsUi.shared;
  const st = t.adsUi.status;
  const now = useNow(STATUS_CLOCK_MS);

  // Search and both filters run on the SERVER: the list is paginated, so
  // filtering the loaded page would hide every match past the first page.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdStatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<AdTypeFilter>("ALL");
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
      adService.getAds({
        page,
        limit: PAGE_LIMIT,
        search: appliedSearch || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        format: typeFilter === "ALL" ? undefined : typeFilter,
      }),
    [appliedSearch, page, statusFilter, typeFilter],
  );

  // The Ad settings are read here rather than in their card: the statuses
  // ("Paused by settings"), "Will it show?" and the wizard all need them,
  // and the card's warnings come from live counts that an ad change moves,
  // so every change below reads them again. A read is stamped when it was
  // asked for, a save when it answered — a read asked after a save always
  // carries it, so the newer copy is the one to show.
  const settingsRead = useAsyncData(() => {
    const at = Date.now();
    return adService.getSettings().then((settings): SettingsCopy => ({ settings, at }));
  }, []);
  const [savedSettings, setSavedSettings] = useState<SettingsCopy | null>(null);
  const readSettings = settingsRead.data;
  const newestSettings =
    !savedSettings || (readSettings && readSettings.at > savedSettings.at) ? readSettings : savedSettings;
  const settings = newestSettings?.settings ?? null;
  const refreshSettings = settingsRead.refetch;

  // What the server last told us after a change, on top of the loaded page —
  // so a switch or a save shows at once without a full reload.
  const [local, setLocal] = useState<Record<string, Ad>>({});
  const rows = useMemo(() => (data?.items ?? []).map((row) => local[row.id] ?? row), [data, local]);
  // Rows removed elsewhere can leave a later page empty: step back to the last page that has rows.
  useClampPage({
    page,
    pageSize: PAGE_LIMIT,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const [howOpen, setHowOpen] = useHowAdsWorkOpen();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [initialStep, setInitialStep] = useState<AdStepId | undefined>(undefined);
  const [initialMoreOpen, setInitialMoreOpen] = useState(false);
  const [preview, setPreview] = useState<Ad | null>(null);
  // The checker keeps its ad after closing, so the dialog can play its exit.
  const [why, setWhy] = useState<Ad | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [initialAdId] = useState(readInitialAdId);
  /**
   * Set when "Will it show?" closes to hand the admin over to the Ad
   * settings card or the wizard: its closing then leaves focus alone instead
   * of sending it back to the row — behind the wizard, or scrolling the page
   * away from the card. Cleared when the checker opens again. State, not a
   * ref: the handlers that set it are handed to the rows during render.
   */
  const [handingOff, setHandingOff] = useState(false);

  // The checker follows the row: a fix that saves (the switch, "Also play
  // before the movie") replaces the row, and the checker reads it again.
  const whyAd = why ? (rows.find((row) => row.id === why.id) ?? local[why.id] ?? why) : null;

  const reload = () => {
    setLocal({});
    refetch();
  };

  /** Reports a refused change; a stale list is reloaded so the next try works. */
  const fail = (title: string, err: unknown) => {
    toast.error(title, { description: adErrorMessage(err, t) });
    if (err instanceof ApiError && err.code === "AD_NOT_FOUND") {
      setWhyOpen(false);
      reload();
    }
  };

  const replace = (saved: Ad) => setLocal((prev) => ({ ...prev, [saved.id]: saved }));

  const openCreate = () => {
    setEditing(null);
    setInitialStep(undefined);
    setInitialMoreOpen(false);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  /**
   * Edit opens on the Summary, or on `step` when a fix in "Will it show?"
   * names one ("Change hours" → "when", with `openMore`, as the hours sit
   * under "More options").
   */
  const openEdit = (ad: Ad, step?: AdStepId, openMore = false) => {
    setEditing(ad);
    setInitialStep(step);
    setInitialMoreOpen(openMore);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    dropQueryParam("ad");
  };

  const closePreview = () => {
    setPreview(null);
    dropQueryParam("ad");
  };

  const openWhy = (ad: Ad) => {
    setHandingOff(false);
    setWhy(ad);
    setWhyOpen(true);
  };

  /** Closes the checker for the card or the wizard, which take focus themselves. */
  const leaveWhy = () => {
    setHandingOff(true);
    setWhyOpen(false);
  };

  /**
   * Opens the Ad settings card and brings it into view — "Open Ad settings"
   * in the checker, and the wizard's "change this in Ad settings" links.
   */
  const jumpToSettings = () => {
    setSettingsOpen(true);
    window.setTimeout(() => {
      const card = document.getElementById(AD_SETTINGS_CARD_ID);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, SETTINGS_JUMP_DELAY_MS);
  };

  // The deep link: the ad is read on its own (it may sit on another page of
  // the list) and opened for editing, or for a preview when the staff
  // member may only look.
  useEffect(() => {
    if (!initialAdId) return;
    let cancelled = false;
    adService
      .getAd(initialAdId)
      .then((ad) => {
        if (cancelled) return;
        if (canManage) openEdit(ad);
        else setPreview(ad);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(l.loadError, { description: adErrorMessage(err, t) });
        dropQueryParam("ad");
      });
    return () => {
      cancelled = true;
    };
    // Mount-only by design (see above); the rest are stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAdId]);

  const handleSaved = (saved: Ad) => {
    replace(saved);
    // A new ad is not on the loaded page yet — read the list again so it shows.
    if (!data?.items.some((row) => row.id === saved.id)) refetch();
    refreshSettings();
  };

  const handleToggleActive = async (ad: Ad, isActive: boolean) => {
    setBusyId(ad.id);
    try {
      replace(await adService.updateAd(ad.id, { isActive }));
      toast.success(isActive ? st.turnedOnToast : st.turnedOffToast);
      refreshSettings();
    } catch (err) {
      fail(st.changeFailedToast, err);
    } finally {
      setBusyId(null);
    }
  };

  /** "Also play before the movie": a breaks-only ad then plays before the movie while ad breaks are off. */
  const handleAlsoBeforeMovie = async (ad: Ad) => {
    setBusyId(ad.id);
    try {
      replace(await adService.updateAd(ad.id, { playsBeforeMovie: true }));
      toast.success(t.adsUi.why.fixes.alsoBeforeToast);
      refreshSettings();
    } catch (err) {
      fail(st.changeFailedToast, err);
    } finally {
      setBusyId(null);
    }
  };

  const handleFix = (ad: Ad, fix: AdFix) => {
    switch (fix.kind) {
      case "OPEN_SETTINGS":
        leaveWhy();
        jumpToSettings();
        return;
      case "TURN_ON":
        void handleToggleActive(ad, true);
        return;
      case "EDIT":
        leaveWhy();
        openEdit(ad, fix.step, fix.openMore);
        return;
      case "ALSO_BEFORE_MOVIE":
        void handleAlsoBeforeMovie(ad);
        return;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adService.deleteAd(deleteTarget.id);
      toast.success(l.deletedToast);
      setDeleteTarget(null);
      setLocal({});
      // The last row of a later page was removed: step back a page instead
      // of showing an empty table.
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else refetch();
      refreshSettings();
    } catch (err) {
      fail(l.deleteFailedToast, err);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const listActions = {
    canManage,
    busyId,
    settings,
    now,
    onToggleActive: handleToggleActive,
    onWhy: openWhy,
    onPreview: setPreview,
    onEdit: (ad: Ad) => openEdit(ad),
    onDelete: setDeleteTarget,
  };
  const columns = getAdColumns({ t, ...listActions });

  const newButton = canManage ? (
    <Button onClick={openCreate} disabled={isLoading || !!error}>
      <Plus className="size-4" />
      {s.newAd}
    </Button>
  ) : null;

  const headerActions = (
    <>
      <Button
        variant="outline"
        aria-expanded={howOpen}
        aria-controls={HOW_ADS_WORK_ID}
        onClick={() => setHowOpen((open) => !open)}
      >
        <CircleHelp className="size-4" />
        {t.adsUi.how.title}
      </Button>
      {/* The sidebar links Ad results on wide screens; on a phone it sits behind the menu. */}
      <Button variant="outline" className="md:hidden" render={<Link href={AD_RESULTS_HREF} />} nativeButton={false}>
        <ChartColumn className="size-4" />
        {s.adResults}
      </Button>
      {newButton}
    </>
  );

  const genuinelyEmpty =
    !isLoading && rows.length === 0 && !search && statusFilter === "ALL" && typeFilter === "ALL" && page === 1;

  return (
    <div>
      <PageHeader title={l.title} description={l.description} actions={headerActions} />
      {!canManage && <p className="-mt-3 mb-4 text-sm text-muted-foreground">{l.readOnly}</p>}

      <HowAdsWork open={howOpen} onOpenChange={setHowOpen} />

      <AdSettingsCard
        settings={settings}
        error={settingsRead.error}
        onRetry={refreshSettings}
        onSaved={(next) => setSavedSettings({ settings: next, at: Date.now() })}
        canManage={canManage}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      {error ? (
        <ErrorState description={l.loadError} onRetry={reload} />
      ) : genuinelyEmpty ? (
        // The full-page empty state stands in only for a genuinely empty
        // list — with a term typed or a filter chosen the list (and the box
        // being typed into) must stay mounted, showing its own no-results line.
        <EmptyState icon={Clapperboard} title={l.emptyTitle} description={l.emptyDescription} action={newButton} />
      ) : (
        <div className="flex flex-col gap-4">
          <AdListToolbar
            search={search}
            onSearchChange={setSearch}
            type={typeFilter}
            onTypeChange={(value) => {
              // The chip already on: nothing changes, so the page stays.
              if (value === typeFilter) return;
              setPage(1);
              setTypeFilter(value);
            }}
            status={statusFilter}
            onStatusChange={(value) => {
              if (value === statusFilter) return;
              setPage(1);
              setStatusFilter(value);
            }}
          />
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              pageSize={PAGE_LIMIT}
              manualPagination
              rowClassName={() => "[&>td]:align-top"}
              emptyState={<p className="text-sm text-muted-foreground">{l.noMatches}</p>}
            />
          </div>
          <div className="md:hidden">
            <AdCardList ads={rows} isLoading={isLoading} {...listActions} />
          </div>
          {!isLoading && data && (
            <ServerPagination page={page} pageSize={PAGE_LIMIT} total={data.total} onPageChange={setPage} />
          )}
          <p className="text-[13px] text-muted-foreground">
            {l.footnote.before}
            <Link href={AD_RESULTS_HREF} className="text-info underline-offset-4 hover:underline">
              {l.footnote.link}
            </Link>
            {l.footnote.after}
          </p>
        </div>
      )}

      {canManage && formOpen && (
        <AdWizard
          key={formKey}
          open={formOpen}
          onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}
          ad={editing}
          onSaved={handleSaved}
          onStale={reload}
          settings={settings}
          initialStep={editing ? initialStep : undefined}
          initialMoreOpen={editing ? initialMoreOpen : false}
          onOpenSettings={() => {
            closeForm();
            jumpToSettings();
          }}
        />
      )}

      {whyAd && (
        <WhyNotPlaying
          open={whyOpen}
          onOpenChange={setWhyOpen}
          ad={whyAd}
          settings={settings}
          now={now}
          canManage={canManage}
          busy={busyId === whyAd.id}
          onFix={handleFix}
          onEdit={(ad) => {
            leaveWhy();
            openEdit(ad);
          }}
          finalFocus={() => !handingOff}
        />
      )}

      {preview && (
        <AdPreviewDialog
          key={preview.id}
          open
          onOpenChange={(open) => !open && closePreview()}
          ad={preview}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
        title={l.deleteTitle}
        description={deleteTarget ? l.deleteDescription(deleteTarget.title) : ""}
        confirmLabel={s.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function AdsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="ADS.VIEW" title={t.adsUi.list.title} description={t.adsUi.list.description}>
      <AdsContent />
    </RequirePermission>
  );
}
