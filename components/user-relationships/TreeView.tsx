"use client";

/**
 * Tree View — the second tab.
 *
 * Indented, expandable outline rooted at the seed phone, alternating
 * phone -> user -> phone levels. The underlying network is a graph, not a
 * tree, so a node reached a second time is shown as a "↩ seen" reference chip
 * instead of duplicating its whole subtree (which would otherwise recurse
 * forever on a cycle).
 *
 * Expansion state is shared with the graph canvas, so Expand All / Collapse
 * All and progressive disclosure stay consistent across both views.
 */

import { Fragment, useMemo } from "react";
import { ChevronRight, CornerUpLeft, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GraphNode,
  RelationshipEdgeKind,
  RelationshipGraph,
} from "./useRelationshipGraph";

export interface TreeViewLabels {
  seen: string;
  seenTitle: string;
  profileLink: string;
  withdrawalLink: string;
  depositsCount: (count: number) => string;
  usersCount: (count: number) => string;
  seedBadge: string;
  expand: string;
  collapse: string;
  empty: string;
  showInGraph: string;
  treeAriaLabel: string;
}

export const defaultTreeViewLabels: TreeViewLabels = {
  seen: "seen",
  seenTitle: "Already shown higher up in this tree",
  profileLink: "profile",
  withdrawalLink: "withdrawal",
  depositsCount: (count) => `${count} deposits`,
  usersCount: (count) => `${count} users`,
  seedBadge: "Seed",
  expand: "Expand",
  collapse: "Collapse",
  empty: "Nothing to show yet.",
  showInGraph: "Focus in graph",
  treeAriaLabel: "Relationship tree",
};

export interface TreeViewProps {
  graph: RelationshipGraph;
  labels?: Partial<TreeViewLabels>;
  className?: string;
}

interface TreeRow {
  key: string;
  node: GraphNode;
  level: number;
  /** True when this row is a back-reference to a node already listed above. */
  seen: boolean;
  linkKind: RelationshipEdgeKind | null;
  childCount: number;
}

export function TreeView({ graph, labels: labelOverrides, className }: TreeViewProps) {
  const labels = useMemo(
    () => ({ ...defaultTreeViewLabels, ...labelOverrides }),
    [labelOverrides],
  );

  const { rootId, nodeById, edges, collapsedIds, toggleCollapse, selectedId, select, pathNodeIds, matchIds, visitedIds, focusNode } =
    graph;

  /** Full-graph adjacency (not the spanning tree) so cross-links surface. */
  const neighbours = useMemo(() => {
    const map = new Map<string, { otherId: string; kind: RelationshipEdgeKind }[]>();
    /* One pair can be joined by BOTH a PROFILE and a WITHDRAWAL edge — a user
     * whose profile number is also the account they withdraw to, which is the
     * common case rather than a rare one. The tree shows one row per
     * relationship, so those collapse into a single entry; leaving both would
     * walk the child twice under the same parent, emitting two rows with the
     * identical React key (`<parentKey>/<id>`) and doubling the child count on
     * the chevron. PROFILE wins the label because it is the stronger claim,
     * and deciding by kind rather than payload order keeps the tree
     * deterministic. */
    const merged = new Map<string, { otherId: string; kind: RelationshipEdgeKind }>();
    const push = (from: string, otherId: string, kind: RelationshipEdgeKind) => {
      const pairKey = `${from}>${otherId}`;
      const existing = merged.get(pairKey);
      if (existing) {
        // Same object as the one already in `map`, so this upgrades in place.
        if (kind === "PROFILE") existing.kind = "PROFILE";
        return;
      }
      const entry = { otherId, kind };
      merged.set(pairKey, entry);
      const list = map.get(from);
      if (list) list.push(entry);
      else map.set(from, [entry]);
    };
    for (const edge of edges) {
      push(edge.sourceId, edge.targetId, edge.kind);
      push(edge.targetId, edge.sourceId, edge.kind);
    }
    return map;
  }, [edges]);

  const rows = useMemo(() => {
    const out: TreeRow[] = [];
    if (!rootId) return out;
    const visited = new Set<string>();

    const walk = (
      id: string,
      level: number,
      parentId: string | null,
      keyPrefix: string,
      linkKind: RelationshipEdgeKind | null,
    ) => {
      const node = nodeById.get(id);
      if (!node) return;
      const key = `${keyPrefix}/${id}`;
      const kids = (neighbours.get(id) ?? []).filter((n) => n.otherId !== parentId);

      if (visited.has(id)) {
        out.push({ key, node, level, seen: true, linkKind, childCount: 0 });
        return;
      }
      visited.add(id);
      out.push({ key, node, level, seen: false, linkKind, childCount: kids.length });
      if (collapsedIds.has(id)) return;
      for (const child of kids) {
        walk(child.otherId, level + 1, id, key, child.kind);
      }
    };

    walk(rootId, 0, null, "", null);
    return out;
  }, [rootId, nodeById, neighbours, collapsedIds]);

  if (!rows.length) {
    return (
      <div
        className={cn(
          "flex h-40 items-center justify-center rounded-xl bg-card/60 text-sm text-muted-foreground ring-1 ring-border",
          className,
        )}
      >
        {labels.empty}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-h-[560px] overflow-auto rounded-xl bg-card/60 p-2 ring-1 ring-border",
        className,
      )}
      role="tree"
      aria-label={labels.treeAriaLabel}
    >
      {rows.map((row) => {
        const { node } = row;
        const isUser = node.kind === "USER";
        const accent = isUser ? "var(--chart-5)" : "var(--chart-3)";
        const isSelected = !row.seen && selectedId === node.id;
        const onPath = !row.seen && pathNodeIds.has(node.id);
        const matched = !row.seen && matchIds.has(node.id);
        const visited = !row.seen && visitedIds.has(node.id);
        const collapsed = collapsedIds.has(node.id);

        return (
          <div
            key={row.key}
            role="treeitem"
            aria-level={row.level + 1}
            aria-selected={isSelected}
            aria-expanded={row.childCount > 0 ? !collapsed : undefined}
            className="relative"
            style={{ paddingLeft: row.level * 20 }}
          >
            {row.level > 0 && (
              <span
                aria-hidden
                className="absolute top-0 bottom-0 w-px bg-border"
                style={{ left: row.level * 20 - 10 }}
              />
            )}
            <div
              className={cn(
                "group my-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                row.seen
                  ? "opacity-60"
                  : "cursor-pointer hover:bg-secondary/60",
                isSelected && "bg-primary/12 ring-1 ring-primary/40",
                !isSelected && onPath && "bg-secondary/40",
                matched && !isSelected && "ring-1 ring-[var(--warning)]/50",
                visited && !isSelected && !matched && "ring-1 ring-[var(--chart-2)]/50",
              )}
              onClick={() => {
                if (row.seen) return;
                select(node.id);
              }}
              onDoubleClick={() => {
                if (row.seen) return;
                focusNode(node.id);
              }}
            >
              {row.childCount > 0 && !row.seen ? (
                <button
                  type="button"
                  aria-label={collapsed ? labels.expand : labels.collapse}
                  title={collapsed ? labels.expand : labels.collapse}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleCollapse(node.id);
                  }}
                  className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      !collapsed && "rotate-90",
                    )}
                  />
                </button>
              ) : (
                <span className="size-4 shrink-0" />
              )}

              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  backgroundColor: `color-mix(in oklch, ${accent}, transparent 82%)`,
                  color: accent,
                }}
              >
                {isUser ? <User className="size-3.5" /> : <Phone className="size-3.5" />}
              </span>

              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{node.label}</span>
                {isUser && node.sublabel && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    @{node.sublabel}
                  </span>
                )}
              </span>

              {row.linkKind && !row.seen && (
                <span className="hidden shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                  {row.linkKind === "PROFILE" ? labels.profileLink : labels.withdrawalLink}
                </span>
              )}

              {node.isSeed && (
                <span className="shrink-0 rounded-full bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                  {labels.seedBadge}
                </span>
              )}

              {row.seen ? (
                <span
                  title={labels.seenTitle}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <CornerUpLeft className="size-2.5" />
                  {labels.seen}
                </span>
              ) : (
                <Fragment>
                  {isUser ? (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {labels.depositsCount(node.user?.depositCount ?? 0)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {labels.usersCount(node.phone?.userCount ?? 0)} ·{" "}
                      {labels.depositsCount(node.phone?.depositCount ?? 0)}
                    </span>
                  )}
                </Fragment>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
