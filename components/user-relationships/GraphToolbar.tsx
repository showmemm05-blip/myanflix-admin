"use client";

/**
 * The row above the canvas: legend on the left, view toggle in the middle,
 * find-in-graph / fit / fullscreen / reset on the right.
 *
 * Every string comes in through `labels` — the page owns i18n and hands us
 * `t.userRelationships.toolbar`; the English values here are only a fallback.
 */

import { useMemo } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Network,
  Phone,
  RotateCcw,
  Scan,
  Search,
  ListTree,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RelationshipGraph } from "./useRelationshipGraph";

export type RelationshipView = "graph" | "tree";

export interface GraphToolbarLabels {
  legendTitle: string;
  viewToggleLabel: string;
  legendUser: string;
  legendPhone: string;
  legendSelected: string;
  legendVisited: string;
  graphView: string;
  treeView: string;
  findPlaceholder: string;
  findAriaLabel: string;
  clearSearch: string;
  matchCount: (count: number) => string;
  noMatches: string;
  fitToView: string;
  enterFullscreen: string;
  exitFullscreen: string;
  resetLayout: string;
  expandAll: string;
  collapseAll: string;
  showMinimap: string;
  hideMinimap: string;
  phonePlaceholder: string;
  phoneAriaLabel: string;
  phoneSubmit: string;
}

export const defaultGraphToolbarLabels: GraphToolbarLabels = {
  legendTitle: "Legend",
  viewToggleLabel: "View",
  legendUser: "User",
  legendPhone: "Phone Number",
  legendSelected: "Selected",
  legendVisited: "Visited",
  graphView: "Graph View",
  treeView: "Tree View",
  findPlaceholder: "Find in graph…",
  findAriaLabel: "Find in graph",
  clearSearch: "Clear search",
  matchCount: (count) => `${count} match${count === 1 ? "" : "es"}`,
  noMatches: "No matches",
  fitToView: "Fit to view",
  enterFullscreen: "Fullscreen",
  exitFullscreen: "Exit fullscreen",
  resetLayout: "Reset Layout",
  expandAll: "Expand All",
  collapseAll: "Collapse All",
  phonePlaceholder: "e.g. 09777888999",
  phoneAriaLabel: "Search another phone number",
  phoneSubmit: "Search",
  showMinimap: "Show minimap",
  hideMinimap: "Hide minimap",
};

export interface GraphToolbarProps {
  graph: RelationshipGraph;
  labels?: Partial<GraphToolbarLabels>;
  /** Omit `view`/`onViewChange` to hide the segmented control. */
  view?: RelationshipView;
  onViewChange?: (view: RelationshipView) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Fit is a canvas concern, so the page wires it to the canvas' viewport. */
  onFitToView?: () => void;
  /**
   * Minimap visibility, lifted out of the canvas so this control could take
   * over the slot the left rail gave up to the layout switch. Omit both to
   * hide the button.
   */
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  /**
   * Look up a DIFFERENT number without scrolling back to the page's search
   * card. Deliberately separate from find-in-graph on the right: this one
   * fetches a new network, that one filters the one already drawn. Omit the
   * handler to hide the field.
   */
  phoneQuery?: string;
  onPhoneQueryChange?: (value: string) => void;
  onPhoneSubmit?: () => void;
  phoneBusy?: boolean;
  /** Validation message for the phone field, shown inline beside it. */
  phoneError?: string | null;
  className?: string;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export function GraphToolbar({
  graph,
  labels: labelOverrides,
  view,
  onViewChange,
  fullscreen = false,
  onToggleFullscreen,
  onFitToView,
  showMinimap,
  onToggleMinimap,
  phoneQuery,
  onPhoneQueryChange,
  onPhoneSubmit,
  phoneBusy,
  phoneError,
  className,
}: GraphToolbarProps) {
  const labels = useMemo(
    () => ({ ...defaultGraphToolbarLabels, ...labelOverrides }),
    [labelOverrides],
  );

  const { query, setQuery, matches, matchIds, focusNode, select, viewport, bounds } = graph;

  const fit = onFitToView ?? (() => viewport.fit(bounds, true));

  /**
   * Before the first search this row IS the search bar — the legend, the view
   * toggle and every graph control would be describing and operating on
   * nothing. They appear with the graph.
   */
  const hasGraph = graph.nodes.length > 0;

  const jumpToFirstMatch = () => {
    const first = matches[0];
    if (!first) return;
    select(first.id);
    focusNode(first.id);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card/60 px-3 py-2 ring-1 ring-border",
        className,
      )}
    >
      {/* Look up another number, in the graph row. Kept visually apart from
          find-in-graph (right) — one loads a network, the other filters it. */}
      {onPhoneSubmit && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onPhoneSubmit();
          }}
          className="flex items-center gap-1.5"
        >
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[var(--chart-3)]" />
            <Input
              value={phoneQuery ?? ""}
              inputMode="tel"
              autoComplete="off"
              aria-label={labels.phoneAriaLabel}
              placeholder={labels.phonePlaceholder}
              onChange={(event) => onPhoneQueryChange?.(event.target.value)}
              className="h-8 w-44 pl-7 text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 px-2.5 text-xs" disabled={phoneBusy}>
            <Search data-icon="inline-start" />
            {labels.phoneSubmit}
          </Button>
          {phoneError && (
            <span className="text-xs text-destructive">{phoneError}</span>
          )}
        </form>
      )}

      {/* Legend */}
      {hasGraph && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <LegendDot color="var(--chart-5)" label={labels.legendUser} />
        <LegendDot color="var(--chart-3)" label={labels.legendPhone} />
        <LegendDot color="var(--primary)" label={labels.legendSelected} />
        {/* --warning already means "seed" and "search match" on the canvas, so
            the visited trail gets its own hue rather than a third meaning. */}
        <LegendDot color="var(--chart-2)" label={labels.legendVisited} />
      </div>
      )}

      {/* View toggle */}
      {hasGraph && view && onViewChange && (
        <div
          role="tablist"
          aria-label={labels.viewToggleLabel}
          className="inline-flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5"
        >
          {(["graph", "tree"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => onViewChange(value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors",
                view === value && "bg-card text-foreground shadow-sm",
              )}
            >
              {value === "graph" ? (
                <Network className="size-3.5" />
              ) : (
                <ListTree className="size-3.5" />
              )}
              {value === "graph" ? labels.graphView : labels.treeView}
            </button>
          ))}
        </div>
      )}

      {/* Right cluster */}
      {hasGraph && (
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            aria-label={labels.findAriaLabel}
            placeholder={labels.findPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToFirstMatch();
              }
              if (event.key === "Escape") setQuery("");
            }}
            className="h-8 w-44 pl-7 text-xs"
          />
          {query.length > 0 && (
            <button
              type="button"
              aria-label={labels.clearSearch}
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {query.trim().length > 0 && (
          <span
            className={cn(
              "text-[11px] tabular-nums",
              matchIds.size ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {matchIds.size ? labels.matchCount(matchIds.size) : labels.noMatches}
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={graph.expandAll}
          title={labels.expandAll}
        >
          <ChevronsUpDown data-icon="inline-start" />
          <span className="hidden sm:inline">{labels.expandAll}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={graph.collapseAll}
          title={labels.collapseAll}
        >
          <ChevronsDownUp data-icon="inline-start" />
          <span className="hidden sm:inline">{labels.collapseAll}</span>
        </Button>

        {onToggleMinimap && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleMinimap}
            aria-pressed={showMinimap}
            title={showMinimap ? labels.hideMinimap : labels.showMinimap}
            aria-label={showMinimap ? labels.hideMinimap : labels.showMinimap}
            className={cn(showMinimap && "bg-secondary text-foreground")}
          >
            <MapIcon />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={fit}
          title={labels.fitToView}
          aria-label={labels.fitToView}
        >
          <Scan />
        </Button>

        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFullscreen}
            title={fullscreen ? labels.exitFullscreen : labels.enterFullscreen}
            aria-label={fullscreen ? labels.exitFullscreen : labels.enterFullscreen}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        )}

        <Button variant="secondary" size="sm" onClick={graph.resetLayout}>
          <RotateCcw data-icon="inline-start" />
          {labels.resetLayout}
        </Button>
      </div>
      )}
    </div>
  );
}
