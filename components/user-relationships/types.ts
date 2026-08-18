/**
 * ============================================================================
 * SHARED CONTRACT for the User Relationships feature.
 * ============================================================================
 *
 * The one file the page shell and the graph components agree on.
 *
 * Ownership split:
 *   page shell + StatsBar / NodeDetailsPanel / RecentActivityStrip → admin-core
 *   GraphCanvas / TreeView / Minimap / GraphToolbar / useRelationshipGraph → graph agent
 *
 * ---------------------------------------------------------------------------
 * How the pieces fit together
 * ---------------------------------------------------------------------------
 * 1. The PAGE owns the request. `userRelationshipService.getRelationshipNetwork`
 *    + `useAsyncData` give it the `RelationshipNetwork`, because the page is
 *    what renders the idle / loading / error / no-results states.
 * 2. `useRelationshipGraph(network)` is PURE — it never fetches. It turns the
 *    payload into the drawable model (`RelationshipGraph`) and owns every piece
 *    of graph interaction state: selection, path-back-to-seed, expand/collapse,
 *    find-in-graph, node positions, focus requests and the pan/zoom viewport.
 * 3. Every graph component receives that single `graph` object rather than
 *    fifteen individual props, so canvas/tree/toolbar can never disagree about
 *    what is selected, collapsed or matched.
 * 4. i18n stays in the page. Graph components take a plain `labels` bag of
 *    already-translated strings (each has an English default) instead of
 *    reaching for the `useLanguage` hook themselves.
 *
 * ---------------------------------------------------------------------------
 * Node identity
 * ---------------------------------------------------------------------------
 * Node ids carry a kind prefix so a user and a phone can never collide inside
 * the same Map/Set: `u:<userId>` and `p:<normalizedDigits>`. Always build them
 * with `userNodeId` / `phoneNodeId` (re-exported below) and take them apart
 * with `parseNodeId`.
 */
import type {
  RelationshipEdgeKind,
  RelationshipNetwork,
} from "@/types/user-relationship";
import type { GraphNode, RelationshipGraph } from "./useRelationshipGraph";

/**
 * The graph model itself is declared alongside its implementation in
 * `useRelationshipGraph.ts` and re-exported here, so there is exactly one
 * definition of each shape and no chance of the two drifting apart.
 *
 * - `GraphLayoutMode` — `"radial" | "layered"`; which arrangement the canvas draws.
 * - `GraphNode`    — `{ id, kind: "USER"|"PHONE", label, sublabel, meta, depth,
 *                      isSeed, halfWidth, halfHeight, user?, phone?, parentId,
 *                      parentEdgeId, childIds, neighbourIds }`
 * - `GraphEdge`    — `{ id, sourceId (phone), targetId (user), kind, withdrawalCount,
 *                      totalAmount, isTreeEdge }`
 * - `RelationshipGraph` — the hook's return value; see its doc comment.
 */
export type {
  Bounds,
  GraphEdge,
  GraphLayoutMode,
  GraphNode,
  GraphNodeKind,
  Point,
  RelationshipGraph,
  Transform,
  ViewportController,
} from "./useRelationshipGraph";

export { phoneNodeId, userNodeId } from "./useRelationshipGraph";

export type { RelationshipEdgeKind, RelationshipNetwork };

/** Signature of the pure client-side graph model hook. */
export type UseRelationshipGraph = (
  network: RelationshipNetwork | null,
) => RelationshipGraph;

/* -------------------------------------------------------------------------- */
/* GraphCanvas                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The hand-rolled SVG canvas — declared in `GraphCanvas.tsx` as
 * `GraphCanvasProps` / `GraphCanvasLabels` and re-exported here so the page has
 * one import site for the whole contract.
 *
 * It owns pointer interaction (wheel-zoom to cursor, drag empty space to pan,
 * drag a node to reposition — a drag past 4px must not fire click-select), the
 * left control rail (hand toggle, zoom +/−, fit, layout mode), the zoom
 * readout + slider, and the Minimap overlay. Selection highlights the node and
 * its path back to the seed while everything else dims; every node opened so
 * far keeps a --chart-2 "visited" marker so the trail stays readable.
 *
 * Minimap VISIBILITY is a prop, not internal state — the toggle sits in the
 * toolbar because the rail's fifth slot went to the layout switch.
 *
 *   `<GraphCanvas graph={graph} labels={…} fullscreen={…} onToggleFullscreen={…} showMinimap={…} />`
 */
export type { GraphCanvasLabels, GraphCanvasProps } from "./GraphCanvas";

/* -------------------------------------------------------------------------- */
/* Minimap                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rendered by GraphCanvas, never by the page — it needs the live transform,
 * which never leaves the canvas. Scaled-down node dots plus a viewport
 * rectangle you can click or drag to move the view.
 */
export type { MinimapProps } from "./Minimap";

/* -------------------------------------------------------------------------- */
/* TreeView                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Second tab: an indented, expandable tree rooted at the seed phone with
 * alternating phone/user levels. A node reached a second time renders a
 * "↩ seen" chip instead of repeating its subtree, so a cycle can't expand
 * forever. Reads selection / collapse / matches from the same `graph` object
 * the canvas uses, so switching tabs preserves all of it.
 */
export type { TreeViewLabels, TreeViewProps } from "./TreeView";

/* -------------------------------------------------------------------------- */
/* GraphToolbar                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Rendered by the PAGE in the canvas card's header row — declared in
 * `GraphToolbar.tsx` and re-exported here.
 *
 * It carries the legend (User / Phone Number / Selected / Visited), the
 * Graph/Tree segmented control, find-in-graph (Enter jumps to the first match),
 * Expand All / Collapse All, the minimap toggle, fit-to-view, Reset Layout and
 * the fullscreen toggle. Fully controlled: the find box and expand/collapse
 * read and write the `graph` object, so the toolbar and the canvas can never
 * disagree.
 */
export type {
  GraphToolbarLabels,
  GraphToolbarProps,
  RelationshipView,
} from "./GraphToolbar";

/* -------------------------------------------------------------------------- */
/* Node id helpers                                                             */
/* -------------------------------------------------------------------------- */

export type ParsedNodeId =
  | { kind: "USER"; userId: string }
  | { kind: "PHONE"; normalized: string }
  | null;

/** Inverse of `userNodeId` / `phoneNodeId`; null for anything unrecognized. */
export function parseNodeId(id: string | null | undefined): ParsedNodeId {
  if (!id) return null;
  const separator = id.indexOf(":");
  if (separator === -1) return null;
  const value = id.slice(separator + 1);
  if (!value) return null;
  const prefix = id.slice(0, separator);
  if (prefix === "u") return { kind: "USER", userId: value };
  if (prefix === "p") return { kind: "PHONE", normalized: value };
  return null;
}

/** Narrowing helpers so consumers don't re-test `node.kind` and `node.user` separately. */
export function isUserNode(
  node: GraphNode | null | undefined,
): node is GraphNode & { user: NonNullable<GraphNode["user"]> } {
  return !!node && node.kind === "USER" && !!node.user;
}

export function isPhoneNode(
  node: GraphNode | null | undefined,
): node is GraphNode & { phone: NonNullable<GraphNode["phone"]> } {
  return !!node && node.kind === "PHONE" && !!node.phone;
}

/* `RelationshipView` ("graph" | "tree") — which of the two view tabs is active.
   Owned by the page, passed to the toolbar; re-exported from ./GraphToolbar
   alongside its props above. */
