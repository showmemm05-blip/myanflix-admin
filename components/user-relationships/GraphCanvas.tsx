"use client";

/**
 * Hand-rolled SVG network canvas (no graph library, no new dependencies).
 *
 * Interaction model
 *  - drag empty space ......... pan
 *  - drag a node .............. reposition it (pointer capture; a drag past 4px
 *                               suppresses the click-select on release, and a
 *                               node drag never bleeds into a pan)
 *  - wheel .................... zoom toward the cursor
 *  - click a node ............. select + highlight its path back to the seed
 *  - double-click a node ...... focus (centre + zoom in)
 *  - chevron badge ............ collapse / expand that subtree
 *  - hand toggle .............. drag anywhere pans, nodes stop being draggable
 *
 * Nothing above re-renders the graph: pan/zoom write straight to the root
 * <g transform>, and node dragging writes to the dragged node's <g> plus the
 * <path d> of its incident edges, all inside one rAF. React state is only
 * touched on pointer-up.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  ChevronDown,
  Crosshair,
  Hand,
  Minimize2,
  MousePointer2,
  Network,
  Phone,
  User,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Minimap } from "./Minimap";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  PHONE_NODE_SIZE,
  USER_NODE_SIZE,
  type GraphEdge,
  type GraphNode,
  type Point,
  type RelationshipGraph,
  type ViewportController,
} from "./useRelationshipGraph";

/* ------------------------------------------------------------------ *
 * Strings — passed in by the page (which owns i18n); English is only the
 * fallback for a label the caller didn't supply.
 * ------------------------------------------------------------------ */

export interface GraphCanvasLabels {
  depositsCount: (count: number) => string;
  usersCount: (count: number) => string;
  seed: string;
  panMode: string;
  selectMode: string;
  zoomIn: string;
  zoomOut: string;
  fitToView: string;
  /** aria-label for the minimap overlay itself (the toggle now lives in the toolbar). */
  minimap: string;
  /** Names the ACTIVE arrangement, so the tooltip reads as a state, not a verb. */
  layoutRadial: string;
  layoutLayered: string;
  visitedNode: string;
  exitFullscreen: string;
  zoomLevel: string;
  expandSubtree: string;
  collapseSubtree: string;
  hiddenCount: (count: number) => string;
  emptyCanvas: string;
}

export const defaultGraphCanvasLabels: GraphCanvasLabels = {
  depositsCount: (count) => `${count} Deposits`,
  usersCount: (count) => `${count} Users`,
  seed: "Seed",
  panMode: "Pan (hand) mode",
  selectMode: "Select / drag mode",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitToView: "Fit to view",
  minimap: "Minimap",
  layoutRadial: "Layout: Radial",
  layoutLayered: "Layout: Layered by level",
  visitedNode: "Already visited",
  exitFullscreen: "Exit fullscreen",
  zoomLevel: "Zoom level",
  expandSubtree: "Expand",
  collapseSubtree: "Collapse",
  hiddenCount: (count) => `+${count}`,
  emptyCanvas: "Nothing to draw yet.",
};

export interface GraphCanvasProps {
  graph: RelationshipGraph;
  labels?: Partial<GraphCanvasLabels>;
  /** Renders the canvas as a full-screen overlay. */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /**
   * Minimap visibility. Controlled by the page so the toggle can live in the
   * toolbar next to the other view switches — the left rail's fifth slot is
   * the layout control now.
   */
  showMinimap?: boolean;
  /** Height of the (non-fullscreen) canvas. */
  height?: number | string;
  className?: string;
}

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

/**
 * `spread` scales the perpendicular bow. Edges joining the same pair get
 * different (mirrored) values so they stay individually visible — the same
 * user/phone pair is routinely joined by BOTH a PROFILE and a WITHDRAWAL edge
 * (the profile number is also the withdrawal account), and a shared bow would
 * draw the dashed one exactly under the solid one.
 */
function edgePath(a: Point, b: Point, spread = 1): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(26, len * 0.08) * spread;
  const cx = (a.x + b.x) / 2 + (-dy / len) * bow;
  const cy = (a.y + b.y) / 2 + (dx / len) * bow;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** `useLayoutEffect` warns when a client component is pre-rendered on the
 * server; the pre-render has nothing to paint anyway. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ------------------------------------------------------------------ *
 * Node view
 * ------------------------------------------------------------------ */

interface NodeHandlers {
  register: (id: string, el: SVGGElement | null) => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>, id: string) => void;
  onPointerMove: (event: React.PointerEvent<SVGGElement>, id: string) => void;
  onPointerUp: (event: React.PointerEvent<SVGGElement>, id: string) => void;
  onDoubleClick: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

interface GraphNodeViewProps {
  node: GraphNode;
  labels: GraphCanvasLabels;
  handlers: NodeHandlers;
  selected: boolean;
  onPath: boolean;
  matched: boolean;
  /** Opened at least once during this investigation. */
  visited: boolean;
  dimmed: boolean;
  collapsed: boolean;
  hiddenChildren: number;
  draggable: boolean;
}

const GraphNodeView = memo(function GraphNodeView({
  node,
  labels,
  handlers,
  selected,
  onPath,
  matched,
  visited,
  dimmed,
  collapsed,
  hiddenChildren,
  draggable,
}: GraphNodeViewProps) {
  const isUser = node.kind === "USER";
  const accent = isUser ? "var(--chart-5)" : "var(--chart-3)";
  const size = isUser ? USER_NODE_SIZE : PHONE_NODE_SIZE;
  const hasChildren = node.childIds.length > 0;

  /* Colour ownership, so no two meanings ever share a hue:
   *   --primary  selection          --warning  seed ring + search matches
   *   --chart-2  visited trail      accent     node kind (user / phone)
   * Selection and matches win over the trail, because they describe "right
   * now" while visited describes history. */
  const strokeColor = selected
    ? "var(--primary)"
    : matched
      ? "var(--warning)"
      : visited
        ? "var(--chart-2)"
        : onPath
          ? accent
          : `color-mix(in oklch, ${accent}, transparent 45%)`;

  return (
    <g
      ref={(el) => {
        handlers.register(node.id, el);
      }}
      data-node-id={node.id}
      className={cn(
        "cursor-pointer outline-none",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        opacity: dimmed ? 0.42 : 1,
        transition: "opacity 260ms ease",
      }}
      tabIndex={-1}
      onPointerDown={(event) => handlers.onPointerDown(event, node.id)}
      onPointerMove={(event) => handlers.onPointerMove(event, node.id)}
      onPointerUp={(event) => handlers.onPointerUp(event, node.id)}
      onPointerCancel={(event) => handlers.onPointerUp(event, node.id)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        handlers.onDoubleClick(node.id);
      }}
    >
      {/* Seed / selection ring */}
      {(node.isSeed || selected) && (
        <rect
          x={-size.w / 2 - 7}
          y={-size.h / 2 - 7}
          width={size.w + 14}
          height={size.h + 14}
          rx={isUser ? 21 : 24}
          fill="none"
          stroke={node.isSeed ? "var(--warning)" : "var(--primary)"}
          strokeWidth={1.5}
          strokeDasharray={node.isSeed ? "5 4" : undefined}
          opacity={0.85}
        />
      )}

      {/* Visited marker — a dot the eye can find at low zoom, in the trail
          colour, pinned to the drawn shape (rect corner for a user, circle
          edge for a phone) and clear of the collapse badge opposite it. */}
      {visited && !selected && (
        <g transform={isUser ? `translate(${size.w / 2 - 9} -21)` : "translate(22 -38)"}>
          <title>{labels.visitedNode}</title>
          <circle
            r={4.5}
            style={{ fill: "var(--chart-2)", stroke: "var(--card)", strokeWidth: 1.5 }}
          />
        </g>
      )}

      {isUser ? (
        <>
          <rect
            x={-size.w / 2}
            y={-size.h / 2}
            width={size.w}
            height={size.h}
            rx={14}
            style={{
              fill: `color-mix(in oklch, ${accent}, var(--card) 78%)`,
              stroke: strokeColor,
              strokeWidth: selected || matched || visited ? 2 : 1.25,
            }}
          />
          <circle
            cx={-size.w / 2 + 25}
            cy={0}
            r={14}
            style={{ fill: `color-mix(in oklch, ${accent}, transparent 70%)` }}
          />
          <g transform={`translate(${-size.w / 2 + 17} -8)`} style={{ color: accent }}>
            <User width={16} height={16} />
          </g>
          <text
            x={-size.w / 2 + 46}
            y={-8}
            style={{ fill: "var(--foreground)", fontSize: 13.5, fontWeight: 600 }}
          >
            {truncate(node.label, 17)}
          </text>
          <text
            x={-size.w / 2 + 46}
            y={6}
            style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          >
            @{truncate(node.sublabel, 18)}
          </text>
          <text x={-size.w / 2 + 46} y={20} style={{ fill: accent, fontSize: 11 }}>
            {labels.depositsCount(node.user?.depositCount ?? 0)}
          </text>
        </>
      ) : (
        <>
          <circle
            cx={0}
            cy={-16}
            r={30}
            style={{
              fill: `color-mix(in oklch, ${accent}, var(--card) 76%)`,
              stroke: strokeColor,
              strokeWidth: selected || matched || visited ? 2 : 1.25,
            }}
          />
          <g transform="translate(-9 -25)" style={{ color: accent }}>
            <Phone width={18} height={18} />
          </g>
          <text
            x={0}
            y={26}
            textAnchor="middle"
            style={{ fill: "var(--foreground)", fontSize: 12.5, fontWeight: 600 }}
          >
            {truncate(node.label, 16)}
          </text>
          <text
            x={0}
            y={40}
            textAnchor="middle"
            style={{ fill: "var(--muted-foreground)", fontSize: 10.5 }}
          >
            {labels.usersCount(node.phone?.userCount ?? 0)} ·{" "}
            {/* Deposits made BY the users on this number. There is no
                phone->deposit link in the data, so this is a statistic about
                the people attached here, not traffic through the number. */}
            {labels.depositsCount(node.phone?.depositCount ?? 0)}
          </text>
        </>
      )}

      {/* Collapse / expand badge */}
      {hasChildren && (
        <g
          transform={`translate(${size.w / 2 - 4} ${size.h / 2 - 4})`}
          role="button"
          aria-label={collapsed ? labels.expandSubtree : labels.collapseSubtree}
          className="cursor-pointer"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            handlers.onToggleCollapse(node.id);
          }}
        >
          <circle
            r={11}
            style={{
              fill: "var(--popover)",
              stroke: `color-mix(in oklch, ${accent}, transparent 40%)`,
              strokeWidth: 1.25,
            }}
          />
          {collapsed && hiddenChildren > 0 ? (
            <text
              y={3.5}
              textAnchor="middle"
              style={{ fill: accent, fontSize: 10, fontWeight: 700 }}
            >
              {labels.hiddenCount(hiddenChildren)}
            </text>
          ) : (
            <g
              style={{
                color: accent,
                transform: collapsed
                  ? "translate(-6px, -6px) rotate(-90deg)"
                  : "translate(-6px, -6px)",
                transformOrigin: "6px 6px",
                transition: "transform 220ms ease",
              }}
            >
              <ChevronDown width={12} height={12} />
            </g>
          )}
        </g>
      )}
    </g>
  );
});

/* ------------------------------------------------------------------ *
 * Zoom readout + slider (subscribes to the viewport so the graph doesn't)
 * ------------------------------------------------------------------ */

function ZoomControl({
  viewport,
  label,
}: {
  viewport: ViewportController;
  label: string;
}) {
  const [zoom, setZoom] = useState(1);
  const frame = useRef(0);

  useEffect(() => {
    // rAF-throttled: the controller emits on every pointermove during a pan,
    // but this readout only needs one repaint per frame.
    const unsubscribe = viewport.subscribe(() => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setZoom(viewport.get().k);
      });
    });
    return () => {
      unsubscribe();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [viewport]);

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-popover/85 px-2.5 py-1.5 ring-1 ring-border backdrop-blur">
      <span className="w-11 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <input
        type="range"
        aria-label={label}
        min={Math.round(MIN_ZOOM * 100)}
        max={Math.round(MAX_ZOOM * 100)}
        step={1}
        value={Math.round(zoom * 100)}
        onChange={(event) => viewport.setZoom(Number(event.target.value) / 100)}
        className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
    </div>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Canvas
 * ------------------------------------------------------------------ */

export function GraphCanvas({
  graph,
  labels: labelOverrides,
  fullscreen = false,
  onToggleFullscreen,
  showMinimap = true,
  height = 560,
  className,
}: GraphCanvasProps) {
  const labels = useMemo(
    () => ({ ...defaultGraphCanvasLabels, ...labelOverrides }),
    [labelOverrides],
  );

  const {
    visibleNodes,
    visibleEdges,
    positions,
    bounds,
    selectedId,
    select,
    pathNodeIds,
    pathEdgeIds,
    matchIds,
    visitedIds,
    layoutMode,
    toggleLayoutMode,
    collapsedIds,
    toggleCollapse,
    focusNode,
    focusNonce,
    focusTargetId,
    setNodePosition,
    layoutNonce,
    rootId,
    viewport,
  } = graph;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const edgeEls = useRef(new Map<string, SVGPathElement>());
  /** Positions actually painted right now (tweened / dragged). */
  const liveRef = useRef(new Map<string, Point>());

  const [handMode, setHandMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const edgeIndex = useMemo(() => {
    const byNode = new Map<string, GraphEdge[]>();
    for (const edge of visibleEdges) {
      for (const id of [edge.sourceId, edge.targetId]) {
        const list = byNode.get(id);
        if (list) list.push(edge);
        else byNode.set(id, [edge]);
      }
    }
    return byNode;
  }, [visibleEdges]);

  /* Per-edge bow multiplier: a lone edge keeps the default gentle curve, while
   * edges sharing a pair fan out symmetrically (-1, +1 for the usual
   * PROFILE + WITHDRAWAL pair) so neither hides the other. */
  const bowById = useMemo(() => {
    const groups = new Map<string, GraphEdge[]>();
    for (const edge of visibleEdges) {
      const key = `${edge.sourceId}|${edge.targetId}`;
      const list = groups.get(key);
      if (list) list.push(edge);
      else groups.set(key, [edge]);
    }
    const out = new Map<string, number>();
    for (const list of groups.values()) {
      list.forEach((edge, index) => {
        out.set(edge.id, list.length === 1 ? 1 : index * 2 - (list.length - 1));
      });
    }
    return out;
  }, [visibleEdges]);

  /* ---- painting ----------------------------------------------------- */

  const paintNode = useCallback(
    (id: string) => {
      const point = liveRef.current.get(id);
      const el = nodeEls.current.get(id);
      if (point && el) el.setAttribute("transform", `translate(${point.x} ${point.y})`);
      for (const edge of edgeIndex.get(id) ?? []) {
        const path = edgeEls.current.get(edge.id);
        const a = liveRef.current.get(edge.sourceId);
        const b = liveRef.current.get(edge.targetId);
        if (path && a && b) path.setAttribute("d", edgePath(a, b, bowById.get(edge.id) ?? 1));
      }
    },
    [edgeIndex, bowById],
  );

  const paintAll = useCallback(() => {
    liveRef.current.forEach((point, id) => {
      const el = nodeEls.current.get(id);
      if (el) el.setAttribute("transform", `translate(${point.x} ${point.y})`);
    });
    for (const edge of visibleEdges) {
      const path = edgeEls.current.get(edge.id);
      const a = liveRef.current.get(edge.sourceId);
      const b = liveRef.current.get(edge.targetId);
      if (path && a && b) path.setAttribute("d", edgePath(a, b, bowById.get(edge.id) ?? 1));
    }
  }, [visibleEdges, bowById]);

  const registerNode = useCallback((id: string, el: SVGGElement | null) => {
    if (!el) {
      nodeEls.current.delete(id);
      return;
    }
    nodeEls.current.set(id, el);
    const point = liveRef.current.get(id);
    if (point) el.setAttribute("transform", `translate(${point.x} ${point.y})`);
  }, []);

  const registerEdge = useCallback((id: string, el: SVGPathElement | null) => {
    if (!el) {
      edgeEls.current.delete(id);
      return;
    }
    edgeEls.current.set(id, el);
  }, []);

  /* Tween from the currently painted positions to the new layout. Runs on
   * expand/collapse and Reset Layout; a drop is a no-op because the live map
   * already sits on the committed position. */
  useIsomorphicLayoutEffect(() => {
    const live = liveRef.current;
    const from = new Map<string, Point>();
    let needsTween = false;

    positions.forEach((target, id) => {
      const current = live.get(id);
      if (!current) {
        live.set(id, { x: target.x, y: target.y });
        return;
      }
      from.set(id, { x: current.x, y: current.y });
      if (Math.abs(current.x - target.x) > 0.5 || Math.abs(current.y - target.y) > 0.5) {
        needsTween = true;
      }
    });
    for (const id of [...live.keys()]) {
      if (!positions.has(id)) live.delete(id);
    }

    if (!needsTween) {
      paintAll();
      return;
    }

    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 380);
      const e = 1 - Math.pow(1 - p, 3);
      positions.forEach((target, id) => {
        const origin = from.get(id);
        if (!origin) {
          live.set(id, { x: target.x, y: target.y });
          return;
        }
        live.set(id, {
          x: origin.x + (target.x - origin.x) * e,
          y: origin.y + (target.y - origin.y) * e,
        });
      });
      paintAll();
      frame = p < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [positions, paintAll]);

  /* ---- viewport plumbing -------------------------------------------- */

  useEffect(
    () =>
      viewport.subscribe((t) => {
        const world = worldRef.current;
        if (world) {
          world.setAttribute("transform", `translate(${t.x} ${t.y}) scale(${t.k})`);
        }
      }),
    [viewport],
  );

  const [measured, setMeasured] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      viewport.setSize(rect.width, rect.height);
      setMeasured((prev) =>
        Math.abs(prev.w - rect.width) < 1 && Math.abs(prev.h - rect.height) < 1
          ? prev
          : { w: rect.width, h: rect.height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewport]);

  // Fit once per dataset and again whenever Reset Layout runs.
  const lastFitRef = useRef("");
  useEffect(() => {
    if (!bounds || !rootId || measured.w < 2) return;
    const key = `${rootId}|${layoutNonce}|${fullscreen}`;
    if (lastFitRef.current === key) return;
    lastFitRef.current = key;
    viewport.fit(bounds, false);
    // `bounds` intentionally excluded past the first fit — collapsing a subtree
    // shouldn't yank the camera around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, layoutNonce, measured.w, measured.h, fullscreen, viewport]);

  const fitToView = useCallback(() => viewport.fit(bounds, true), [viewport, bounds]);

  // Focus-on-node: double-click, or the panel/toolbar bumping focusNonce.
  useEffect(() => {
    if (!focusTargetId) return;
    const point = positions.get(focusTargetId);
    if (!point) return;
    viewport.centerOn(point.x, point.y, Math.max(viewport.get().k, 1), true);
    // Re-runs on every focus request, even for the same node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce, focusTargetId]);

  // Wheel must be a non-passive native listener — React's synthetic wheel
  // handler is passive and can't preventDefault the page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const intensity = event.deltaMode === 1 ? 18 : 1;
      const factor = Math.pow(0.9985, event.deltaY * intensity);
      viewport.zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [viewport]);

  /* ---- pointer interaction ------------------------------------------ */

  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  /** Set while the last background gesture was an actual pan, so releasing it
   * doesn't read as a "click the background to deselect". */
  const panMovedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    nodeId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<(() => void) | null>(null);

  const schedule = useCallback((work: () => void) => {
    pendingRef.current = work;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const job = pendingRef.current;
      pendingRef.current = null;
      job?.();
    });
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const beginPan = useCallback(
    (event: React.PointerEvent<Element>) => {
      const transform = viewport.get();
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: transform.x,
        originY: transform.y,
        moved: false,
      };
      panMovedRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
    },
    [viewport],
  );

  const onSurfacePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      beginPan(event);
    },
    [beginPan],
  );

  const onSurfacePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      const dx = event.clientX - pan.startX;
      const dy = event.clientY - pan.startY;
      if (!pan.moved && Math.hypot(dx, dy) > 4) {
        pan.moved = true;
        panMovedRef.current = true;
      }
      schedule(() => {
        const current = viewport.get();
        viewport.set({ x: pan.originX + dx, y: pan.originY + dy, k: current.k });
      });
    },
    [schedule, viewport],
  );

  const endPan = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
  }, []);

  const onSurfaceClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // A pan that happened to end over the background is not a "deselect"
      // click — only a stationary press on the grid clears the selection.
      if (panMovedRef.current) {
        panMovedRef.current = false;
        return;
      }
      const target = event.target as Element;
      if (event.target === event.currentTarget || target.hasAttribute("data-surface")) {
        select(null);
      }
    },
    [select],
  );

  const nodeHandlers = useMemo<NodeHandlers>(
    () => ({
      register: registerNode,
      onPointerDown: (event, id) => {
        if (event.button !== 0) return;
        // Hand mode: nodes are inert, the gesture becomes a pan.
        if (handMode) return;
        event.stopPropagation();
        const point = liveRef.current.get(id);
        if (!point) return;
        dragRef.current = {
          pointerId: event.pointerId,
          nodeId: id,
          startX: event.clientX,
          startY: event.clientY,
          originX: point.x,
          originY: point.y,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event, id) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || drag.nodeId !== id) return;
        const dxScreen = event.clientX - drag.startX;
        const dyScreen = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dxScreen, dyScreen) > 4) drag.moved = true;
        if (!drag.moved) return;
        const k = viewport.get().k || 1;
        const next = {
          x: drag.originX + dxScreen / k,
          y: drag.originY + dyScreen / k,
        };
        schedule(() => {
          liveRef.current.set(id, next);
          paintNode(id);
        });
      },
      onPointerUp: (event, id) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || drag.nodeId !== id) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag.moved) {
          // A drag past the 4px threshold must not also select the node.
          event.stopPropagation();
          const point = liveRef.current.get(id);
          if (point) setNodePosition(id, { x: point.x, y: point.y });
          return;
        }
        select(id);
      },
      onDoubleClick: (id) => {
        select(id);
        focusNode(id);
      },
      onToggleCollapse: toggleCollapse,
    }),
    [
      registerNode,
      handMode,
      schedule,
      paintNode,
      setNodePosition,
      select,
      focusNode,
      toggleCollapse,
      viewport,
    ],
  );

  /* ---- derived render state ------------------------------------------ */

  const hasSelection = Boolean(selectedId);
  const hasQuery = matchIds.size > 0;

  const nodeState = useCallback(
    (node: GraphNode) => {
      const onPath = pathNodeIds.has(node.id);
      const matched = matchIds.has(node.id);
      const visited = visitedIds.has(node.id);
      const dimmed = (hasSelection && !onPath) || (hasQuery && !matched && !onPath);
      return { onPath, matched, visited, dimmed };
    },
    [pathNodeIds, matchIds, visitedIds, hasSelection, hasQuery],
  );

  const hiddenChildCount = useCallback(
    (node: GraphNode) => (collapsedIds.has(node.id) ? node.childIds.length : 0),
    [collapsedIds],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-[color-mix(in_oklch,var(--card),var(--background)_35%)] ring-1 ring-border",
        fullscreen && "fixed inset-0 z-50 rounded-none",
        className,
      )}
      style={fullscreen ? undefined : { height }}
    >
      <svg
        ref={svgRef}
        className={cn(
          "absolute inset-0 h-full w-full touch-none select-none",
          isPanning ? "cursor-grabbing" : handMode ? "cursor-grab" : "cursor-default",
        )}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onClick={onSurfaceClick}
      >
        <defs>
          <pattern id="ur-grid" width={28} height={28} patternUnits="userSpaceOnUse">
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.5}
            />
          </pattern>
        </defs>
        <rect data-surface="" width="100%" height="100%" fill="url(#ur-grid)" />

        <g ref={worldRef}>
          <g>
            {visibleEdges.map((edge) => {
              const onPath = pathEdgeIds.has(edge.id);
              const dimmed = hasSelection && !onPath;
              return (
                <path
                  key={edge.id}
                  ref={(el) => {
                    registerEdge(edge.id, el);
                  }}
                  fill="none"
                  style={{
                    stroke: onPath ? "var(--primary)" : "var(--chart-3)",
                    strokeWidth: onPath ? 2.4 : 1.4,
                    opacity: dimmed ? 0.12 : onPath ? 0.95 : 0.42,
                    transition: "opacity 260ms ease, stroke-width 200ms ease",
                  }}
                  strokeDasharray={edge.kind === "PROFILE" ? undefined : "6 5"}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
          <g>
            {visibleNodes.map((node) => {
              const state = nodeState(node);
              return (
                <GraphNodeView
                  key={node.id}
                  node={node}
                  labels={labels}
                  handlers={nodeHandlers}
                  selected={selectedId === node.id}
                  onPath={state.onPath}
                  matched={state.matched}
                  visited={state.visited}
                  dimmed={state.dimmed}
                  collapsed={collapsedIds.has(node.id)}
                  hiddenChildren={hiddenChildCount(node)}
                  draggable={!handMode}
                />
              );
            })}
          </g>
        </g>
      </svg>

      {!visibleNodes.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {labels.emptyCanvas}
        </div>
      )}

      {/* Minimap — top left */}
      {showMinimap && visibleNodes.length > 0 && (
        <Minimap
          nodes={visibleNodes}
          positions={positions}
          bounds={bounds}
          viewport={viewport}
          selectedId={selectedId}
          matchIds={matchIds}
          visitedIds={visitedIds}
          label={labels.minimap}
          className="absolute top-3 left-3"
        />
      )}

      {/* Left rail */}
      <div className="absolute top-1/2 left-3 flex -translate-y-1/2 flex-col gap-1 rounded-lg bg-popover/85 p-1 ring-1 ring-border backdrop-blur">
        <RailButton
          label={handMode ? labels.panMode : labels.selectMode}
          active={handMode}
          onClick={() => setHandMode((value) => !value)}
        >
          {handMode ? <Hand className="size-4" /> : <MousePointer2 className="size-4" />}
        </RailButton>
        <RailButton label={labels.zoomIn} onClick={() => viewport.zoomBy(1.25)}>
          <ZoomIn className="size-4" />
        </RailButton>
        <RailButton label={labels.zoomOut} onClick={() => viewport.zoomBy(1 / 1.25)}>
          <ZoomOut className="size-4" />
        </RailButton>
        <RailButton label={labels.fitToView} onClick={fitToView}>
          <Crosshair className="size-4" />
        </RailButton>
        {/* Fifth slot: which of the two arrangements is drawn. The tooltip
            names the ACTIVE mode; the minimap toggle moved to the toolbar. */}
        <RailButton
          label={layoutMode === "layered" ? labels.layoutLayered : labels.layoutRadial}
          active={layoutMode === "layered"}
          onClick={toggleLayoutMode}
        >
          {layoutMode === "layered" ? (
            <Network className="size-4" />
          ) : (
            <Waypoints className="size-4" />
          )}
        </RailButton>
        {fullscreen && onToggleFullscreen && (
          <RailButton label={labels.exitFullscreen} onClick={onToggleFullscreen}>
            <Minimize2 className="size-4" />
          </RailButton>
        )}
      </div>

      {/* Zoom readout + slider — bottom left */}
      <div className="pointer-events-none absolute bottom-3 left-3">
        <ZoomControl viewport={viewport} label={labels.zoomLevel} />
      </div>
    </div>
  );
}
