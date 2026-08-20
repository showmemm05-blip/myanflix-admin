"use client";

/**
 * User Relationship Hierarchy.
 *
 * Answers one question: which accounts are the same person (or the same ring)?
 * The link key is PHONE NUMBERS — a user's profile phone plus the account
 * number on each of their withdrawals. Deposits are deliberately not a link:
 * a deposit records only the account WE received into, which every customer
 * shares, so joining on it would fuse the entire customer base into one blob.
 * Deposit figures still appear, but strictly as statistics.
 *
 * This file is the shell: search, states, layout and i18n. The drawing itself
 * lives in ./components/user-relationships (GraphCanvas / TreeView /
 * GraphToolbar), which is fed by the pure `useRelationshipGraph` model — the
 * fetch stays here because this is what renders idle / loading / error /
 * no-results.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Network, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { GraphCanvas } from "@/components/user-relationships/GraphCanvas";
import { GraphToolbar } from "@/components/user-relationships/GraphToolbar";
import { NodeDetailsPanel } from "@/components/user-relationships/NodeDetailsPanel";
import { RecentActivityStrip } from "@/components/user-relationships/RecentActivityStrip";
import { StatsBar } from "@/components/user-relationships/StatsBar";
import { TreeView } from "@/components/user-relationships/TreeView";
import { useRelationshipGraph } from "@/components/user-relationships/useRelationshipGraph";
import type { RelationshipView } from "@/components/user-relationships/types";
import type { RelationshipNetworkStats } from "@/types/user-relationship";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { isSearchablePhone } from "@/lib/phone";
import { userRelationshipService } from "@/services/api/userRelationshipService";

/**
 * What the tiles read before a search. Zeros rather than skeletons: nothing is
 * loading, nothing is hidden — the network is simply empty until a number is
 * entered, and the canvas beside them says so in words.
 */
/** Canvas height, shared with the placeholder so results don't shift the page. */
const CANVAS_HEIGHT = "clamp(560px, calc(100vh - 300px), 900px)";

const EMPTY_STATS: RelationshipNetworkStats = {
  totalUsers: 0,
  totalPhones: 0,
  totalDeposits: 0,
  totalWithdrawals: 0,
  maxDepth: 0,
  truncated: false,
  activityTruncated: false,
};

export default function UserRelationshipsPage() {
  const { t } = useLanguage();
  const copy = t.userRelationships;

  const [phoneInput, setPhoneInput] = useState("");
  /** The phone actually being looked up — set only on submit, so typing doesn't refetch. */
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [view, setView] = useState<RelationshipView>("graph");
  const [fullscreen, setFullscreen] = useState(false);
  /* The minimap toggle lives in the toolbar while the canvas draws the map, so
     the flag has to sit above both of them. */
  const [showMinimap, setShowMinimap] = useState(true);

  /**
   * Deep link: /users/relationships?phone=09... (the payout-number chips on a
   * user profile) auto-runs the search once on mount. Read straight from
   * window.location instead of useSearchParams so this stays additive — no
   * Suspense boundary, no re-run when the param later changes.
   */
  useEffect(() => {
    const phone = new URLSearchParams(window.location.search).get("phone")?.trim();
    if (phone && isSearchablePhone(phone)) {
      // Initializing state from an external system (the URL) on mount — the
      // documented exception to the derived-state rule this lint guards.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhoneInput(phone);
      setSubmittedPhone(phone);
    }
  }, []);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      submittedPhone
        ? userRelationshipService.getRelationshipNetwork(submittedPhone)
        : Promise.resolve(null),
    [submittedPhone],
  );

  const graph = useRelationshipGraph(data);

  /**
   * A phone that matches nothing comes back 200 with empty arrays, so "found
   * nothing" has to be told apart from "the request failed" — they need
   * different words and only one of them offers a retry.
   */
  const status: "idle" | "loading" | "error" | "empty" | "ready" =
    !submittedPhone
      ? "idle"
      : isLoading
        ? "loading"
        : error
          ? "error"
          : !data || (data.users.length === 0 && data.phones.length === 0)
            ? "empty"
            : "ready";

  /** Shared by the search card and the copy of the field inside the graph row. */
  const runSearch = () => {
    const value = phoneInput.trim();
    if (!isSearchablePhone(value)) {
      setValidationError(copy.search.tooShort);
      return;
    }
    setValidationError(null);
    setSubmittedPhone(value);
  };


  /* ---------------------------------------------------------------- i18n -- */
  /* The graph components take plain string bags instead of reaching for the
     language hook themselves, so translation stays in one place. */

  const canvasLabels = useMemo(
    () => ({
      depositsCount: copy.node.depositsCount,
      usersCount: copy.node.usersCount,
      seed: copy.node.seedBadge,
      panMode: copy.toolbar.pan,
      selectMode: copy.toolbar.selectMode,
      zoomIn: copy.toolbar.zoomIn,
      zoomOut: copy.toolbar.zoomOut,
      fitToView: copy.toolbar.fit,
      minimap: copy.toolbar.minimap,
      layoutRadial: copy.toolbar.layoutRadial,
      layoutLayered: copy.toolbar.layoutLayered,
      visitedNode: copy.node.visited,
      exitFullscreen: copy.toolbar.exitFullscreen,
      zoomLevel: copy.toolbar.zoomLevel,
      expandSubtree: copy.node.expand,
      collapseSubtree: copy.node.collapse,
      hiddenCount: copy.node.hiddenCount,
      emptyCanvas: copy.states.emptyCanvas,
    }),
    [copy],
  );

  const toolbarLabels = useMemo(
    () => ({
      legendTitle: copy.legend.title,
      viewToggleLabel: copy.view.label,
      legendUser: copy.legend.user,
      legendPhone: copy.legend.phone,
      legendSelected: copy.legend.selected,
      legendVisited: copy.legend.visited,
      graphView: copy.view.graph,
      treeView: copy.view.tree,
      findPlaceholder: copy.toolbar.findPlaceholder,
      findAriaLabel: copy.toolbar.findAriaLabel,
      clearSearch: copy.toolbar.clearSearch,
      matchCount: copy.toolbar.matchCount,
      noMatches: copy.toolbar.noMatches,
      fitToView: copy.toolbar.fit,
      enterFullscreen: copy.toolbar.fullscreen,
      exitFullscreen: copy.toolbar.exitFullscreen,
      resetLayout: copy.toolbar.resetLayout,
      expandAll: copy.toolbar.expandAll,
      collapseAll: copy.toolbar.collapseAll,
      showMinimap: copy.toolbar.showMinimap,
      hideMinimap: copy.toolbar.hideMinimap,
      phonePlaceholder: copy.search.placeholder,
      phoneAriaLabel: copy.search.label,
      phoneSubmit: copy.search.button,
    }),
    [copy],
  );

  const treeLabels = useMemo(
    () => ({
      seen: copy.node.seenAgain,
      seenTitle: copy.tree.seenTitle,
      profileLink: copy.tree.profileLink,
      withdrawalLink: copy.tree.withdrawalLink,
      depositsCount: copy.node.depositsCount,
      usersCount: copy.node.usersCount,
      seedBadge: copy.node.seedBadge,
      expand: copy.node.expand,
      collapse: copy.node.collapse,
      empty: copy.tree.empty,
      showInGraph: copy.tree.showInGraph,
      treeAriaLabel: copy.tree.ariaLabel,
    }),
    [copy],
  );

  return (
    <RequirePermission
      permission="USERS.VIEW"
      title={copy.page.title}
      description={copy.page.descriptionShort}
    >
      <div className="space-y-4">
        {/* The shell is always on: stats, the search row, the canvas frame and
            the details panel keep their slots in every state. Only the canvas
            swaps its contents — so entering a number fills the page in rather
            than replacing one screen with a different one. */}
        <StatsBar
          stats={
            status === "ready" && data
              ? data.stats
              : status === "loading"
                ? null
                : EMPTY_STATS
          }
        />

        <GraphToolbar
          graph={graph}
          labels={toolbarLabels}
          view={view}
          onViewChange={setView}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((open) => !open)}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap((open) => !open)}
          phoneQuery={phoneInput}
          onPhoneQueryChange={(value) => {
            setPhoneInput(value);
            if (validationError) setValidationError(null);
          }}
          onPhoneSubmit={runSearch}
          phoneBusy={isLoading}
          phoneError={validationError}
        />

        {/* Progressive disclosure is otherwise invisible: a big network simply
            opens with most of itself missing. Say so, and offer the one click
            that undoes it. */}
        {status === "ready" && graph.autoCollapsed && graph.hiddenNodeCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--chart-3)]/40 bg-[var(--chart-3)]/8 px-3 py-2.5">
            <p className="min-w-0 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {copy.states.partiallyFoldedTitle}
              </span>{" "}
              {copy.states.partiallyFoldedDescription(graph.hiddenNodeCount)}
            </p>
            <Button variant="secondary" size="sm" onClick={graph.expandAll}>
              <ChevronsUpDown data-icon="inline-start" />
              {copy.toolbar.expandAll}
            </Button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="glass-card overflow-hidden p-0">
            <CardContent className="p-0">
              {status === "ready" && data ? (
                view === "graph" ? (
                  <GraphCanvas
                    graph={graph}
                    labels={canvasLabels}
                    fullscreen={fullscreen}
                    onToggleFullscreen={() => setFullscreen((open) => !open)}
                    showMinimap={showMinimap}
                    height={CANVAS_HEIGHT}
                  />
                ) : (
                  <TreeView
                    graph={graph}
                    labels={treeLabels}
                    className="border-0 bg-transparent ring-0"
                  />
                )
              ) : (
                /* Same height as the canvas, so the page does not jump when a
                   result lands. */
                <div
                  className="flex flex-col items-center justify-center gap-4 px-6 text-center"
                  style={{ height: CANVAS_HEIGHT }}
                >
                  {status === "loading" ? (
                    <>
                      <Skeleton className="size-14 rounded-full" />
                      <Skeleton className="h-4 w-56" />
                      <p className="text-xs text-muted-foreground">
                        {copy.states.loadingTitle}
                      </p>
                    </>
                  ) : (
                    <>
                      <div
                        className={cn(
                          "flex size-14 items-center justify-center rounded-full",
                          status === "error"
                            ? "bg-destructive/12 text-destructive"
                            : status === "empty"
                              ? "bg-muted-foreground/12 text-muted-foreground"
                              : "bg-[var(--chart-3)]/12 text-[var(--chart-3)]",
                        )}
                      >
                        {status === "empty" ? (
                          <Search className="size-7" />
                        ) : (
                          <Network className="size-7" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-medium">
                          {status === "error"
                            ? copy.states.errorTitle
                            : status === "empty"
                              ? copy.states.noResultsTitle(submittedPhone ?? "")
                              : copy.states.idleTitle}
                        </p>
                        <p className="max-w-md text-sm text-muted-foreground">
                          {status === "error"
                            ? copy.states.errorDescription
                            : status === "empty"
                              ? copy.states.noResultsDescription
                              : copy.states.idleDescription}
                        </p>
                      </div>
                      {status === "error" && (
                        <Button variant="secondary" onClick={refetch}>
                          {t.common.retry}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <NodeDetailsPanel
            node={graph.selectedNode}
            network={data}
            onClose={() => graph.select(null)}
            onSelectNode={(id) => graph.select(id)}
            onFocusNode={(id) => graph.focusNode(id)}
            // A suspension changes data the graph itself renders (each account
            // carries its status), so refetch rather than patch one row.
            onUserStatusChanged={refetch}
            className="xl:sticky xl:top-4 xl:self-start"
          />
        </div>

        {status === "ready" && data && (
          <RecentActivityStrip
            items={data.recentActivity}
            truncated={data.stats.activityTruncated}
            onSelectNode={(id) => {
              graph.select(id);
              graph.focusNode(id);
            }}
          />
        )}
      </div>
    </RequirePermission>
  );
}
