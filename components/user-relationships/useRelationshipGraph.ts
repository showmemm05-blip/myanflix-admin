"use client";

/**
 * Client-side graph model for the User Relationship Hierarchy page.
 *
 * Owns everything the SVG canvas / tree need and nothing they don't: the
 * bipartite phone<->user model built from the API payload, two deterministic
 * layouts (radial-by-depth and layered-by-depth), expand/collapse (with
 * progressive disclosure), selection + visited trail + path-back-to-seed,
 * find-in-graph and an imperative viewport controller.
 *
 * The viewport lives OUTSIDE React state on purpose — panning, wheel-zoom and
 * node dragging happen at pointer-event frequency and must never re-render the
 * whole graph. Consumers that genuinely need to display the transform (zoom
 * readout, minimap) subscribe to the controller and repaint themselves.
 */

import { useCallback, useMemo, useState } from "react";

/* The wire shapes live in @/types/user-relationship — the single definition
 * shared with the page shell and the API service. Re-exported here only so
 * the graph components have one import site. */
import type {
  RelationshipEdgeKind,
  RelationshipNetwork,
  RelationshipNetworkPhone,
  RelationshipNetworkUser,
} from "@/types/user-relationship";

export type { RelationshipEdgeKind, RelationshipNetwork };

/* ------------------------------------------------------------------ *
 * Graph model
 * ------------------------------------------------------------------ */

export type GraphNodeKind = "USER" | "PHONE";

export interface GraphNode {
  /** `u:<userId>` or `p:<normalizedPhone>` */
  id: string;
  kind: GraphNodeKind;
  /** BFS depth from the seed phone (seed = 0). */
  depth: number;
  isSeed: boolean;
  /** Primary caption. */
  label: string;
  /** Secondary caption (username / "N users"). */
  sublabel: string;
  /** Tertiary caption (deposit / txn counts). */
  meta: string;
  /** Half-extents used by layout collision resolution and hit-testing. */
  halfWidth: number;
  halfHeight: number;
  user?: RelationshipNetworkUser;
  phone?: RelationshipNetworkPhone;
  /** Tree parent from the BFS spanning tree (null for the seed / orphans). */
  parentId: string | null;
  /** Edge id connecting this node to its tree parent. */
  parentEdgeId: string | null;
  childIds: string[];
  /** Neighbours in the FULL graph (not just the spanning tree). */
  neighbourIds: string[];
}

export interface GraphEdge {
  id: string;
  /** Always the phone-side node id. */
  sourceId: string;
  /** Always the user-side node id. */
  targetId: string;
  kind: RelationshipEdgeKind;
  withdrawalCount: number;
  totalAmount: number;
  /** True when this edge belongs to the BFS spanning tree. */
  isTreeEdge: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Transform {
  x: number;
  y: number;
  k: number;
}

/* Layout constants — exported so the canvas draws nodes at the exact size the
 * collision pass reserved for them. */
export const RING_RADIUS = 205;
/** Vertical distance between two depth levels in the layered layout. */
export const LAYER_HEIGHT = 215;
/** Minimum horizontal breathing room between two nodes on the same layer. */
export const LAYER_GAP = 34;
export const USER_NODE_SIZE = { w: 200, h: 66 };
export const PHONE_NODE_SIZE = { w: 154, h: 106 };
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 3;
/** Networks bigger than this collapse everything past AUTO_COLLAPSE_DEPTH. */
export const AUTO_COLLAPSE_NODE_THRESHOLD = 40;
export const AUTO_COLLAPSE_DEPTH = 2;

/* ------------------------------------------------------------------ *
 * Phone helpers
 * ------------------------------------------------------------------ */

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/* ------------------------------------------------------------------ *
 * Viewport controller (lives outside React state)
 * ------------------------------------------------------------------ */

export interface ViewportController {
  get(): Transform;
  set(next: Transform): void;
  subscribe(listener: (t: Transform) => void): () => void;
  getSize(): { w: number; h: number };
  setSize(w: number, h: number): void;
  /** Zoom by `factor` keeping the screen point (px, py) pinned. */
  zoomAt(factor: number, px: number, py: number): void;
  /** Zoom by `factor` around the middle of the viewport. */
  zoomBy(factor: number): void;
  /** Absolute zoom around the middle of the viewport. */
  setZoom(k: number): void;
  panBy(dx: number, dy: number): void;
  centerOn(x: number, y: number, k?: number, animate?: boolean): void;
  fit(bounds: Bounds | null, animate?: boolean): void;
  /** Screen point -> world point under the current transform. */
  toWorld(px: number, py: number): Point;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function createViewportController(): ViewportController {
  let transform: Transform = { x: 0, y: 0, k: 1 };
  let size = { w: 960, h: 560 };
  const listeners = new Set<(t: Transform) => void>();
  let frame = 0;

  const emit = () => {
    listeners.forEach((listener) => listener(transform));
  };

  const cancel = () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const commit = (next: Transform) => {
    cancel();
    transform = { x: next.x, y: next.y, k: clamp(next.k, MIN_ZOOM, MAX_ZOOM) };
    emit();
  };

  const animateTo = (next: Transform, duration = 420) => {
    cancel();
    const from = transform;
    const to = { x: next.x, y: next.y, k: clamp(next.k, MIN_ZOOM, MAX_ZOOM) };
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast start, gentle settle.
      const e = 1 - Math.pow(1 - p, 3);
      transform = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        k: from.k + (to.k - from.k) * e,
      };
      emit();
      frame = p < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  };

  const zoomAt = (factor: number, px: number, py: number) => {
    const k = clamp(transform.k * factor, MIN_ZOOM, MAX_ZOOM);
    if (k === transform.k) return;
    const wx = (px - transform.x) / transform.k;
    const wy = (py - transform.y) / transform.k;
    commit({ x: px - wx * k, y: py - wy * k, k });
  };

  return {
    get: () => transform,
    set: commit,
    subscribe(listener) {
      listeners.add(listener);
      listener(transform);
      return () => {
        listeners.delete(listener);
      };
    },
    getSize: () => size,
    setSize(w, h) {
      size = { w, h };
    },
    zoomAt,
    zoomBy(factor) {
      zoomAt(factor, size.w / 2, size.h / 2);
    },
    setZoom(k) {
      zoomAt(clamp(k, MIN_ZOOM, MAX_ZOOM) / transform.k, size.w / 2, size.h / 2);
    },
    panBy(dx, dy) {
      commit({ x: transform.x + dx, y: transform.y + dy, k: transform.k });
    },
    centerOn(x, y, k, animate = true) {
      const nextK = clamp(k ?? transform.k, MIN_ZOOM, MAX_ZOOM);
      const next = { x: size.w / 2 - x * nextK, y: size.h / 2 - y * nextK, k: nextK };
      if (animate) animateTo(next);
      else commit(next);
    },
    fit(bounds, animate = true) {
      if (!bounds) return;
      const pad = 64;
      const bw = Math.max(1, bounds.maxX - bounds.minX);
      const bh = Math.max(1, bounds.maxY - bounds.minY);
      // Capped well under MAX_ZOOM: fitting a one- or two-node network to the
      // viewport would otherwise scale it 3x, which reads as a bug rather than
      // as detail. Large networks still shrink freely down to MIN_ZOOM.
      const k = clamp(
        Math.min((size.w - pad * 2) / bw, (size.h - pad * 2) / bh),
        MIN_ZOOM,
        Math.min(MAX_ZOOM, 1.3),
      );
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      const next = { x: size.w / 2 - cx * k, y: size.h / 2 - cy * k, k };
      if (animate) animateTo(next);
      else commit(next);
    },
    toWorld: (px, py) => ({
      x: (px - transform.x) / transform.k,
      y: (py - transform.y) / transform.k,
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Model building
 * ------------------------------------------------------------------ */

export const userNodeId = (userId: string) => `u:${userId}`;
export const phoneNodeId = (normalized: string) => `p:${normalized}`;

interface BuiltGraph {
  nodes: GraphNode[];
  nodeById: Map<string, GraphNode>;
  edges: GraphEdge[];
  edgeById: Map<string, GraphEdge>;
  rootId: string | null;
}

const EMPTY_GRAPH: BuiltGraph = {
  nodes: [],
  nodeById: new Map(),
  edges: [],
  edgeById: new Map(),
  rootId: null,
};

function buildGraph(network: RelationshipNetwork | null): BuiltGraph {
  if (!network) return EMPTY_GRAPH;

  const nodeById = new Map<string, GraphNode>();

  for (const phone of network.phones) {
    const id = phoneNodeId(phone.normalized);
    nodeById.set(id, {
      id,
      kind: "PHONE",
      depth: phone.depth,
      isSeed: phone.normalized === network.seedPhone.normalized,
      label: phone.phone,
      sublabel: "",
      meta: "",
      halfWidth: PHONE_NODE_SIZE.w / 2,
      halfHeight: PHONE_NODE_SIZE.h / 2,
      phone,
      parentId: null,
      parentEdgeId: null,
      childIds: [],
      neighbourIds: [],
    });
  }

  for (const user of network.users) {
    const id = userNodeId(user.id);
    nodeById.set(id, {
      id,
      kind: "USER",
      depth: user.depth,
      isSeed: false,
      label: user.name || user.username,
      sublabel: user.username,
      meta: "",
      halfWidth: USER_NODE_SIZE.w / 2,
      halfHeight: USER_NODE_SIZE.h / 2,
      user,
      parentId: null,
      parentEdgeId: null,
      childIds: [],
      neighbourIds: [],
    });
  }

  const edges: GraphEdge[] = [];
  const edgeById = new Map<string, GraphEdge>();
  const adjacency = new Map<string, { edgeId: string; otherId: string }[]>();

  const link = (from: string, edgeId: string, otherId: string) => {
    const list = adjacency.get(from);
    if (list) list.push({ edgeId, otherId });
    else adjacency.set(from, [{ edgeId, otherId }]);
  };

  for (const raw of network.edges) {
    const source = phoneNodeId(raw.phone);
    const target = userNodeId(raw.userId);
    // Defensive: an edge naming a node the payload didn't include would
    // otherwise produce a dangling line.
    if (!nodeById.has(source) || !nodeById.has(target)) continue;
    const id = `${source}>${target}>${raw.kind}`;
    if (edgeById.has(id)) continue;
    const edge: GraphEdge = {
      id,
      sourceId: source,
      targetId: target,
      kind: raw.kind,
      withdrawalCount: raw.withdrawalCount,
      totalAmount: raw.totalAmount,
      isTreeEdge: false,
    };
    edges.push(edge);
    edgeById.set(id, edge);
    link(source, id, target);
    link(target, id, source);
  }

  for (const node of nodeById.values()) {
    // Deduped: a user whose profile number is also the account they withdraw to
    // has TWO parallel edges (PROFILE + WITHDRAWAL) to the same phone, so the
    // raw adjacency would list that neighbour twice and overstate the degree.
    node.neighbourIds = [
      ...new Set((adjacency.get(node.id) ?? []).map((entry) => entry.otherId)),
    ];
  }

  const rootId = phoneNodeId(network.seedPhone.normalized);
  const root = nodeById.get(rootId) ?? null;

  /* BFS spanning tree from the seed. Deterministic: the payload order decides
   * ties, and both the layout and the "path back to seed" highlight read this
   * tree, so they can never disagree. */
  const visited = new Set<string>();
  const queue: string[] = [];

  if (root) {
    root.depth = 0;
    visited.add(rootId);
    queue.push(rootId);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const currentId = queue[head];
    const current = nodeById.get(currentId)!;
    for (const { edgeId, otherId } of adjacency.get(currentId) ?? []) {
      if (visited.has(otherId)) continue;
      visited.add(otherId);
      const child = nodeById.get(otherId)!;
      child.parentId = currentId;
      child.parentEdgeId = edgeId;
      child.depth = current.depth + 1;
      current.childIds.push(otherId);
      edgeById.get(edgeId)!.isTreeEdge = true;
      queue.push(otherId);
    }
  }

  /* Anything the seed can't reach (shouldn't happen with a correct backend
   * closure, but a truncated response can strand a node) still gets drawn —
   * hung off the root so it stays reachable in both views. */
  if (root) {
    for (const node of nodeById.values()) {
      if (node.id === rootId || visited.has(node.id)) continue;
      node.parentId = rootId;
      node.parentEdgeId = null;
      node.depth = 1;
      root.childIds.push(node.id);
      visited.add(node.id);
    }
  }

  return {
    nodes: [...nodeById.values()],
    nodeById,
    edges,
    edgeById,
    rootId: root ? rootId : null,
  };
}

/* ------------------------------------------------------------------ *
 * Deterministic radial-by-depth layout
 * ------------------------------------------------------------------ */

/**
 * Seed at the origin, depth `d` on a ring of radius `d * RING_RADIUS`, each
 * node's children spread across a slice of the parent's angular sector sized
 * by their visible subtree weight. Pure function of (tree, visible set) — no
 * randomness, so Reset Layout reproduces it exactly.
 */
export function computeRadialLayout(
  graph: BuiltGraph,
  visible: Set<string>,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (!graph.rootId) return positions;

  const weight = new Map<string, number>();
  const weigh = (id: string): number => {
    const node = graph.nodeById.get(id)!;
    const kids = node.childIds.filter((child) => visible.has(child));
    const total = kids.length
      ? kids.reduce((sum, child) => sum + weigh(child), 0)
      : 1;
    weight.set(id, total);
    return total;
  };
  weigh(graph.rootId);

  const place = (id: string, from: number, to: number, depth: number) => {
    const angle = (from + to) / 2;
    const radius = depth * RING_RADIUS;
    positions.set(id, {
      x: depth === 0 ? 0 : Math.cos(angle) * radius,
      y: depth === 0 ? 0 : Math.sin(angle) * radius,
    });
    const node = graph.nodeById.get(id)!;
    const kids = node.childIds.filter((child) => visible.has(child));
    if (!kids.length) return;
    const total = kids.reduce((sum, child) => sum + (weight.get(child) ?? 1), 0) || 1;
    let cursor = from;
    for (const child of kids) {
      const span = ((to - from) * (weight.get(child) ?? 1)) / total;
      place(child, cursor, cursor + span, depth + 1);
      cursor += span;
    }
  };
  // Start at -90° so the first branch leaves the seed upward — stable framing
  // across searches.
  place(graph.rootId, -Math.PI / 2, Math.PI * 1.5, 0);

  relaxCollisions(graph, positions);
  return positions;
}

/* ------------------------------------------------------------------ *
 * Deterministic layered (hierarchical) layout
 * ------------------------------------------------------------------ */

/**
 * The second arrangement offered by the canvas' layout button: one row per BFS
 * depth, seed on top, phones and users alternating downward.
 *
 * Leaves are laid out left to right in tree order and every parent is centred
 * over its own children, so a subtree reads as one block — the shape an admin
 * wants when the question is "how far from the seed is this account?" rather
 * than "who clusters with whom?".
 *
 * Pure function of (tree, visible set), exactly like `computeRadialLayout`, so
 * Reset Layout reproduces it byte for byte.
 */
export function computeLayeredLayout(
  graph: BuiltGraph,
  visible: Set<string>,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (!graph.rootId) return positions;

  let cursor = 0;
  const place = (id: string, depth: number): number => {
    const node = graph.nodeById.get(id)!;
    const kids = node.childIds.filter((child) => visible.has(child));
    let x: number;
    if (kids.length) {
      const childXs = kids.map((child) => place(child, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    } else {
      x = cursor;
      cursor += node.halfWidth * 2 + LAYER_GAP;
    }
    positions.set(id, { x, y: depth * LAYER_HEIGHT });
    return x;
  };
  place(graph.rootId, 0);

  // Re-centre so the seed sits on the origin, matching the radial layout's
  // framing (and keeping `fit` symmetric).
  const rootX = positions.get(graph.rootId)?.x ?? 0;
  positions.forEach((point) => {
    point.x -= rootX;
  });

  separateLayers(graph, positions);
  return positions;
}

/**
 * Horizontal-only separation, applied per row. The generic
 * `relaxCollisions` pass is wrong here because it is free to push along Y,
 * which is exactly what a layered layout must never do — the row IS the
 * information. Sweeping each row left to right and shoving overlaps rightward
 * is monotone, so it always terminates and stays deterministic.
 */
function separateLayers(graph: BuiltGraph, positions: Map<string, Point>) {
  const rows = new Map<number, string[]>();
  positions.forEach((point, id) => {
    const list = rows.get(point.y);
    if (list) list.push(id);
    else rows.set(point.y, [id]);
  });

  for (const row of rows.values()) {
    // Ties broken by id so the sweep can't depend on Map iteration order.
    row.sort((a, b) => {
      const dx = positions.get(a)!.x - positions.get(b)!.x;
      return dx !== 0 ? dx : a < b ? -1 : 1;
    });
    for (let i = 1; i < row.length; i += 1) {
      const prev = graph.nodeById.get(row[i - 1])!;
      const prevPoint = positions.get(row[i - 1])!;
      const node = graph.nodeById.get(row[i])!;
      const point = positions.get(row[i])!;
      const min = prevPoint.x + prev.halfWidth + node.halfWidth + LAYER_GAP;
      if (point.x < min) point.x = min;
    }
  }
}

/** Deterministic separation pass so pills/labels stop overlapping. */
function relaxCollisions(graph: BuiltGraph, positions: Map<string, Point>) {
  const ids = [...positions.keys()].sort();
  const gap = 18;
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      const a = graph.nodeById.get(ids[i])!;
      const pa = positions.get(ids[i])!;
      for (let j = i + 1; j < ids.length; j += 1) {
        const b = graph.nodeById.get(ids[j])!;
        const pb = positions.get(ids[j])!;
        const minX = a.halfWidth + b.halfWidth + gap;
        const minY = a.halfHeight + b.halfHeight + gap;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        // Push along whichever axis needs the least travel.
        if (overlapX / minX < overlapY / minY) {
          const shift = (overlapX / 2) * (dx < 0 ? -1 : 1);
          if (ids[i] !== graph.rootId) pa.x -= shift;
          if (ids[j] !== graph.rootId) pb.x += shift;
        } else {
          const shift = (overlapY / 2) * (dy < 0 ? -1 : 1);
          if (ids[i] !== graph.rootId) pa.y -= shift;
          if (ids[j] !== graph.rootId) pb.y += shift;
        }
      }
    }
    if (!moved) break;
  }
}

/* ------------------------------------------------------------------ *
 * Hook
 * ------------------------------------------------------------------ */

interface KeyedMap<V> {
  key: string;
  map: Map<string, V>;
}

const EMPTY_OVERRIDES: Map<string, boolean> = new Map();
const EMPTY_POSITIONS: Map<string, Point> = new Map();
const EMPTY_VISITED: Set<string> = new Set();

/** Which arrangement the canvas is drawing. */
export type GraphLayoutMode = "radial" | "layered";

export interface RelationshipGraph {
  /** Null until a search has resolved. */
  network: RelationshipNetwork | null;
  rootId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: Map<string, GraphNode>;
  edgeById: Map<string, GraphEdge>;

  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  /** Final position per node id (manual drag wins over the computed layout). */
  positions: Map<string, Point>;
  bounds: Bounds | null;

  selectedId: string | null;
  selectedNode: GraphNode | null;
  select: (id: string | null) => void;
  /** Nodes on the tree path from the selection back to the seed (inclusive). */
  pathNodeIds: Set<string>;
  pathEdgeIds: Set<string>;

  /**
   * Every node the admin has selected since this network loaded — the trail
   * their investigation left through the graph. Grows on `select`, survives
   * deselecting, collapsing and switching views, and starts empty again on the
   * next phone search (it is keyed by the network identity).
   */
  visitedIds: Set<string>;
  isVisited: (id: string) => boolean;

  collapsedIds: Set<string>;
  isCollapsed: (id: string) => boolean;
  toggleCollapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** True when progressive disclosure folded part of the network on load. */
  autoCollapsed: boolean;
  /** How many nodes are currently folded away — 0 once everything is expanded. */
  hiddenNodeCount: number;

  query: string;
  setQuery: (value: string) => void;
  matchIds: Set<string>;
  matches: GraphNode[];

  /** Bumped on every focus request so the canvas re-runs its centre animation. */
  focusNonce: number;
  focusTargetId: string | null;
  focusNode: (id: string) => void;

  setNodePosition: (id: string, point: Point) => void;
  resetLayout: () => void;
  /** Bumped by resetLayout / layout-mode changes / data changes so the canvas can re-fit. */
  layoutNonce: number;

  /** Radial-by-depth (default) or layered/hierarchical-by-depth. */
  layoutMode: GraphLayoutMode;
  setLayoutMode: (mode: GraphLayoutMode) => void;
  toggleLayoutMode: () => void;

  viewport: ViewportController;
}

export function useRelationshipGraph(
  network: RelationshipNetwork | null,
): RelationshipGraph {
  const graph = useMemo(() => buildGraph(network), [network]);

  /* Every piece of interaction state is keyed by the network identity so a new
   * search starts clean without a state-resetting effect. */
  const dataKey = useMemo(
    () =>
      network
        ? `${network.seedPhone.normalized}:${graph.nodes.length}:${graph.edges.length}`
        : "",
    [network, graph.nodes.length, graph.edges.length],
  );

  // Lazy `useState` initializer, not a ref: this instance must be created
  // exactly once and stay identical for the life of the hook, and refs may not
  // be read during render.
  const [viewport] = useState(createViewportController);

  /* -- expand / collapse ------------------------------------------------ */

  // Progressive disclosure: a big network opens folded past depth 2.
  const autoCollapsedIds = useMemo(() => {
    const set = new Set<string>();
    if (graph.nodes.length <= AUTO_COLLAPSE_NODE_THRESHOLD) return set;
    for (const node of graph.nodes) {
      if (node.depth >= AUTO_COLLAPSE_DEPTH && node.childIds.length) set.add(node.id);
    }
    return set;
  }, [graph]);

  const [collapseState, setCollapseState] = useState<KeyedMap<boolean>>({
    key: "",
    map: EMPTY_OVERRIDES,
  });
  const collapseOverrides =
    collapseState.key === dataKey ? collapseState.map : EMPTY_OVERRIDES;

  const collapsedIds = useMemo(() => {
    const set = new Set(autoCollapsedIds);
    collapseOverrides.forEach((collapsed, id) => {
      if (collapsed) set.add(id);
      else set.delete(id);
    });
    return set;
  }, [autoCollapsedIds, collapseOverrides]);

  const visibleNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!graph.rootId) return set;
    const stack = [graph.rootId];
    while (stack.length) {
      const id = stack.pop()!;
      if (set.has(id)) continue;
      set.add(id);
      if (collapsedIds.has(id)) continue;
      const node = graph.nodeById.get(id);
      if (node) stack.push(...node.childIds);
    }
    return set;
  }, [graph, collapsedIds]);

  const toggleCollapse = useCallback(
    (id: string) => {
      setCollapseState((prev) => {
        const base = prev.key === dataKey ? prev.map : EMPTY_OVERRIDES;
        const next = new Map(base);
        const currentlyCollapsed = base.has(id)
          ? base.get(id)!
          : autoCollapsedIds.has(id);
        next.set(id, !currentlyCollapsed);
        return { key: dataKey, map: next };
      });
    },
    [dataKey, autoCollapsedIds],
  );

  const expandAll = useCallback(() => {
    const next = new Map<string, boolean>();
    for (const node of graph.nodes) {
      if (node.childIds.length) next.set(node.id, false);
    }
    setCollapseState({ key: dataKey, map: next });
  }, [graph, dataKey]);

  const collapseAll = useCallback(() => {
    const next = new Map<string, boolean>();
    for (const node of graph.nodes) {
      if (node.childIds.length) next.set(node.id, true);
    }
    setCollapseState({ key: dataKey, map: next });
  }, [graph, dataKey]);

  /* -- layout ----------------------------------------------------------- */

  const [layoutNonce, setLayoutNonce] = useState(0);
  const [layoutState, setLayoutState] = useState<{ key: string; mode: GraphLayoutMode }>({
    key: "",
    mode: "radial",
  });
  // A new search starts back on the default arrangement.
  const layoutMode = layoutState.key === dataKey ? layoutState.mode : "radial";

  /* Manual drags are keyed by network AND mode: a node parked at a radial
   * coordinate is meaningless once the graph is stacked into layers, so each
   * arrangement keeps its own set of hand-placed nodes instead of one
   * polluting the other. */
  const layoutKey = `${dataKey}|${layoutMode}`;

  const setLayoutMode = useCallback(
    (mode: GraphLayoutMode) => {
      setLayoutState({ key: dataKey, mode });
      // Re-fit: the two arrangements have very different extents.
      setLayoutNonce((n) => n + 1);
    },
    [dataKey],
  );

  const toggleLayoutMode = useCallback(
    () => setLayoutMode(layoutMode === "radial" ? "layered" : "radial"),
    [setLayoutMode, layoutMode],
  );

  const [manualState, setManualState] = useState<KeyedMap<Point>>({
    key: "",
    map: EMPTY_POSITIONS,
  });
  const manualPositions =
    manualState.key === layoutKey ? manualState.map : EMPTY_POSITIONS;

  const layout = useMemo(
    () =>
      layoutMode === "layered"
        ? computeLayeredLayout(graph, visibleNodeIds)
        : computeRadialLayout(graph, visibleNodeIds),
    [graph, visibleNodeIds, layoutMode],
  );

  const positions = useMemo(() => {
    const merged = new Map(layout);
    manualPositions.forEach((point, id) => {
      if (merged.has(id)) merged.set(id, point);
    });
    return merged;
  }, [layout, manualPositions]);

  const setNodePosition = useCallback(
    (id: string, point: Point) => {
      setManualState((prev) => {
        const base = prev.key === layoutKey ? prev.map : EMPTY_POSITIONS;
        const next = new Map(base);
        next.set(id, point);
        return { key: layoutKey, map: next };
      });
    },
    [layoutKey],
  );

  const resetLayout = useCallback(() => {
    // Clears only the ACTIVE arrangement's hand-placed nodes — switching back
    // to the other one still finds it exactly as it was left.
    setManualState({ key: layoutKey, map: new Map() });
    setLayoutNonce((n) => n + 1);
  }, [layoutKey]);

  const visibleNodes = useMemo(
    () => graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    [graph, visibleNodeIds],
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
      ),
    [graph, visibleNodeIds],
  );

  const bounds = useMemo<Bounds | null>(() => {
    if (!visibleNodes.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of visibleNodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      minX = Math.min(minX, point.x - node.halfWidth);
      minY = Math.min(minY, point.y - node.halfHeight);
      maxX = Math.max(maxX, point.x + node.halfWidth);
      maxY = Math.max(maxY, point.y + node.halfHeight);
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }, [visibleNodes, positions]);

  /* -- selection + path back to the seed -------------------------------- */

  const [selectState, setSelectState] = useState<{ key: string; id: string | null }>({
    key: "",
    id: null,
  });
  const selectedId = selectState.key === dataKey ? selectState.id : null;

  /* Breadcrumb trail: every node the admin has opened during this
   * investigation. Keyed by `dataKey` like the rest of the interaction state,
   * so a new phone search starts from a clean slate without a reset effect. */
  const [visitState, setVisitState] = useState<{ key: string; ids: Set<string> }>({
    key: "",
    ids: EMPTY_VISITED,
  });
  const visitedIds = visitState.key === dataKey ? visitState.ids : EMPTY_VISITED;

  const select = useCallback(
    (id: string | null) => {
      setSelectState({ key: dataKey, id });
      if (!id) return;
      setVisitState((prev) => {
        const stale = prev.key !== dataKey;
        const base = stale ? EMPTY_VISITED : prev.ids;
        // Re-selecting an already-visited node must not allocate a new Set —
        // that would re-render the whole canvas on every repeat click.
        if (!stale && base.has(id)) return prev;
        const next = new Set(base);
        next.add(id);
        return { key: dataKey, ids: next };
      });
    },
    [dataKey],
  );

  const { pathNodeIds, pathEdgeIds } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    let cursor = selectedId ? graph.nodeById.get(selectedId) : undefined;
    let guard = 0;
    while (cursor && guard < 64) {
      nodeIds.add(cursor.id);
      if (cursor.parentEdgeId) edgeIds.add(cursor.parentEdgeId);
      cursor = cursor.parentId ? graph.nodeById.get(cursor.parentId) : undefined;
      guard += 1;
    }
    return { pathNodeIds: nodeIds, pathEdgeIds: edgeIds };
  }, [selectedId, graph]);

  /* -- find in graph ----------------------------------------------------- */

  const [queryState, setQueryState] = useState<{ key: string; value: string }>({
    key: "",
    value: "",
  });
  const query = queryState.key === dataKey ? queryState.value : "";
  const setQuery = useCallback(
    (value: string) => setQueryState({ key: dataKey, value }),
    [dataKey],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 1) return [] as GraphNode[];
    const needleDigits = digitsOnly(needle);
    return graph.nodes.filter((node) => {
      if (node.kind === "PHONE") {
        const phone = node.phone!;
        if (needleDigits.length >= 2 && phone.normalized.includes(needleDigits)) return true;
        return phone.phone.toLowerCase().includes(needle);
      }
      const user = node.user!;
      if (user.name?.toLowerCase().includes(needle)) return true;
      if (user.username?.toLowerCase().includes(needle)) return true;
      if (needleDigits.length >= 2 && digitsOnly(user.profilePhone).includes(needleDigits))
        return true;
      return false;
    });
  }, [query, graph]);

  const matchIds = useMemo(() => new Set(matches.map((node) => node.id)), [matches]);

  /* -- focus ------------------------------------------------------------- */

  const [focusState, setFocusState] = useState<{ id: string | null; nonce: number }>({
    id: null,
    nonce: 0,
  });
  const focusNode = useCallback((id: string) => {
    setFocusState((prev) => ({ id, nonce: prev.nonce + 1 }));
  }, []);

  return {
    network,
    rootId: graph.rootId,
    nodes: graph.nodes,
    edges: graph.edges,
    nodeById: graph.nodeById,
    edgeById: graph.edgeById,
    visibleNodes,
    visibleEdges,
    positions,
    bounds,
    selectedId,
    selectedNode: selectedId ? (graph.nodeById.get(selectedId) ?? null) : null,
    select,
    pathNodeIds,
    pathEdgeIds,
    visitedIds,
    isVisited: (id: string) => visitedIds.has(id),
    collapsedIds,
    isCollapsed: (id: string) => collapsedIds.has(id),
    toggleCollapse,
    expandAll,
    collapseAll,
    autoCollapsed: autoCollapsedIds.size > 0,
    hiddenNodeCount: Math.max(0, graph.nodes.length - visibleNodes.length),
    query,
    setQuery,
    matchIds,
    matches,
    focusNonce: focusState.nonce,
    focusTargetId: focusState.id,
    focusNode,
    setNodePosition,
    resetLayout,
    layoutNonce,
    layoutMode,
    setLayoutMode,
    toggleLayoutMode,
    viewport,
  };
}
