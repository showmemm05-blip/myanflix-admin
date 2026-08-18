"use client";

/**
 * Scaled-down overview of the network with a draggable viewport rectangle.
 *
 * Like the canvas, this never re-renders while the user pans or zooms — it
 * subscribes to the viewport controller and moves the rect by writing
 * attributes directly.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type {
  Bounds,
  GraphNode,
  Point,
  ViewportController,
} from "./useRelationshipGraph";

export interface MinimapProps {
  nodes: GraphNode[];
  positions: Map<string, Point>;
  bounds: Bounds | null;
  viewport: ViewportController;
  selectedId?: string | null;
  matchIds?: Set<string>;
  /** Nodes already opened during this investigation — drawn in the trail colour. */
  visitedIds?: Set<string>;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}

export function Minimap({
  nodes,
  positions,
  bounds,
  viewport,
  selectedId,
  matchIds,
  visitedIds,
  width = 168,
  height = 116,
  className,
  label = "Minimap",
}: MinimapProps) {
  const rectRef = useRef<SVGRectElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<number | null>(null);

  /** World -> minimap scale, padded so nodes never touch the frame. */
  const projection = useMemo(() => {
    if (!bounds) return null;
    const pad = 10;
    const bw = Math.max(1, bounds.maxX - bounds.minX);
    const bh = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh);
    const offsetX = pad + (width - pad * 2 - bw * scale) / 2 - bounds.minX * scale;
    const offsetY = pad + (height - pad * 2 - bh * scale) / 2 - bounds.minY * scale;
    return {
      scale,
      toMini: (point: Point) => ({
        x: point.x * scale + offsetX,
        y: point.y * scale + offsetY,
      }),
      toWorld: (x: number, y: number) => ({
        x: (x - offsetX) / scale,
        y: (y - offsetY) / scale,
      }),
    };
  }, [bounds, width, height]);

  // Keep the viewport rectangle in sync without a React render.
  useEffect(() => {
    if (!projection) return;
    return viewport.subscribe((transform) => {
      const rect = rectRef.current;
      if (!rect) return;
      const size = viewport.getSize();
      const worldW = size.w / transform.k;
      const worldH = size.h / transform.k;
      const topLeft = projection.toMini({
        x: -transform.x / transform.k,
        y: -transform.y / transform.k,
      });
      rect.setAttribute("x", String(topLeft.x));
      rect.setAttribute("y", String(topLeft.y));
      rect.setAttribute("width", String(Math.max(4, worldW * projection.scale)));
      rect.setAttribute("height", String(Math.max(4, worldH * projection.scale)));
    });
  }, [viewport, projection]);

  const moveViewportTo = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !projection) return;
      const box = svg.getBoundingClientRect();
      const world = projection.toWorld(clientX - box.left, clientY - box.top);
      viewport.centerOn(world.x, world.y, undefined, false);
    },
    [projection, viewport],
  );

  if (!projection) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto overflow-hidden rounded-lg bg-popover/85 ring-1 ring-border backdrop-blur",
        className,
      )}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className="block cursor-crosshair touch-none"
        onPointerDown={(event) => {
          dragRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveViewportTo(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragRef.current !== event.pointerId) return;
          moveViewportTo(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (dragRef.current !== event.pointerId) return;
          dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        {nodes.map((node) => {
          const point = positions.get(node.id);
          if (!point) return null;
          const mini = projection.toMini(point);
          const isSelected = node.id === selectedId;
          const isMatch = matchIds?.has(node.id) ?? false;
          const isVisited = visitedIds?.has(node.id) ?? false;
          return (
            <circle
              key={node.id}
              cx={mini.x}
              cy={mini.y}
              r={node.isSeed ? 4 : isSelected || isMatch || isVisited ? 3.2 : 2.2}
              style={{
                // Same precedence as the canvas, so the two never disagree.
                fill: node.isSeed
                  ? "var(--warning)"
                  : isSelected
                    ? "var(--primary)"
                    : isMatch
                      ? "var(--warning)"
                      : isVisited
                        ? "var(--chart-2)"
                        : node.kind === "USER"
                          ? "var(--chart-5)"
                          : "var(--chart-3)",
                opacity: 0.9,
                transition: "fill 200ms ease",
              }}
            />
          );
        })}
        <rect
          ref={rectRef}
          x={0}
          y={0}
          width={0}
          height={0}
          fill="color-mix(in oklch, var(--foreground), transparent 92%)"
          stroke="var(--foreground)"
          strokeWidth={1}
          opacity={0.65}
          pointerEvents="none"
          rx={2}
        />
      </svg>
    </div>
  );
}
