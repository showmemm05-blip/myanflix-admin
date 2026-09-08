"use client";

import { useId } from "react";

/**
 * The closed glyph set for membership badges. Order is tier order — each key
 * adds ornament richness on top of the same plate + silhouette, so shape (not
 * hue) carries the escalation.
 */
export const LEVEL_BADGE_ICONS = [
  "shield",
  "shield-chevron",
  "shield-facet",
  "crest-crown",
  "wings-crystal",
  "radiant-crystal",
] as const;

export type LevelBadgeIcon = (typeof LEVEL_BADGE_ICONS)[number];

/**
 * Per-channel linear interpolation of two #RRGGBB colors. The badge derives
 * its gradient's light/dark shades from the single stored hex so admins only
 * ever pick one color per level.
 */
function mix(hex: string, other: string, amount: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const a = parse(hex);
  const b = parse(other);
  const channel = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

interface LevelBadgeProps {
  icon: string;
  color: string;
  /** Rendered width/height in px; the 96-unit viewBox scales to fit. */
  size?: number;
}

/**
 * The hexagonal membership-rank badge. This implementation is duplicated
 * VERBATIM in userwebsite/components/level/LevelBadge.tsx (the two apps
 * cannot share code) — admin preview and user badge must stay pixel-identical,
 * so change both or neither.
 */
export function LevelBadge({ icon, color, size = 40 }: LevelBadgeProps) {
  // Multiple badges render per page (the ladder list, the icon picker) — a
  // shared gradient id would make every badge take the first badge's color.
  const gradientId = useId();

  // Unknown icon keys fall back to the naked rank so a future-added key
  // never crashes an old client; a malformed color would NaN the shade math.
  const safeIcon = (LEVEL_BADGE_ICONS as readonly string[]).includes(icon)
    ? (icon as LevelBadgeIcon)
    : "shield";
  const safeColor = HEX_COLOR.test(color) ? color : "#8B909A";

  const light = mix(safeColor, "#FFFFFF", 0.35);
  const dark = mix(safeColor, "#000000", 0.3);

  const oneChevron = (
    <polyline
      points="36,76 48,82 60,76"
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity={0.92}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  const twoChevrons = (
    <g
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity={0.92}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="36,73 48,79 60,73" />
      <polyline points="36,80 48,86 60,80" />
    </g>
  );

  const crown = (
    <path
      d="M 34 26 L 38 16 L 44 23 L 48 13 L 52 23 L 58 16 L 62 26 Z"
      fill={light}
      stroke={dark}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );

  const wings = (
    <g
      fill="none"
      stroke={light}
      strokeOpacity={0.95}
      strokeLinecap="round"
    >
      <path d="M 12 30 Q 2 38 4 52" strokeWidth={3.5} />
      <path d="M 13 40 Q 5 47 7 58" strokeWidth={3} />
      <path d="M 15 50 Q 9 56 10 64" strokeWidth={2.5} />
      <path d="M 84 30 Q 94 38 92 52" strokeWidth={3.5} />
      <path d="M 83 40 Q 91 47 89 58" strokeWidth={3} />
      <path d="M 81 50 Q 87 56 86 64" strokeWidth={2.5} />
    </g>
  );

  const rays = (
    // 45-degree ticks from radius 38 to 43 about (48,48), skipping 90/270
    // where the wings' roots sit — 6 ticks total.
    <g
      stroke="#FFFFFF"
      strokeOpacity={0.75}
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <line x1={48} y1={10} x2={48} y2={5} />
      <line x1={74.87} y1={21.13} x2={78.41} y2={17.59} />
      <line x1={74.87} y1={74.87} x2={78.41} y2={78.41} />
      <line x1={48} y1={86} x2={48} y2={91} />
      <line x1={21.13} y1={74.87} x2={17.59} y2={78.41} />
      <line x1={21.13} y1={21.13} x2={17.59} y2={17.59} />
    </g>
  );

  const sparkles = (
    <g fill="#FFFFFF" fillOpacity={0.95}>
      <path d="M 30 26 L 31.2 28.8 L 34 30 L 31.2 31.2 L 30 34 L 28.8 31.2 L 26 30 L 28.8 28.8 Z" />
      <path d="M 66 22 L 67.2 24.8 L 70 26 L 67.2 27.2 L 66 30 L 64.8 27.2 L 62 26 L 64.8 24.8 Z" />
    </g>
  );

  return (
    // aria-hidden: the accessible name is always the adjacent level-name text.
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={safeColor} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Base plate */}
      <polygon
        points="48,6 84,27 84,69 48,90 12,69 12,27"
        fill={`url(#${gradientId})`}
        stroke={dark}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Inner rim — the bevel that sells the "plate" read */}
      <polygon
        points="48,11.88 78.96,29.94 78.96,66.06 48,84.12 17.04,66.06 17.04,29.94"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.3}
        strokeWidth={2}
      />
      {/* User silhouette — constant across every tier, never tinted or moved */}
      <g fill="#FFFFFF" fillOpacity={0.92}>
        <circle cx={48} cy={40} r={10} />
        <path d="M 30 68 A 18 15 0 0 1 66 68 L 66 70 L 30 70 Z" />
      </g>
      {/* Facet lines — Silver and up would be cluttered; only shield-facet */}
      {safeIcon === "shield-facet" && (
        <g stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={2}>
          <line x1={12} y1={27} x2={30} y2={38} />
          <line x1={84} y1={27} x2={66} y2={38} />
        </g>
      )}
      {safeIcon === "shield-chevron" && oneChevron}
      {(safeIcon === "shield-facet" || safeIcon === "crest-crown") &&
        twoChevrons}
      {(safeIcon === "crest-crown" ||
        safeIcon === "wings-crystal" ||
        safeIcon === "radiant-crystal") &&
        crown}
      {(safeIcon === "wings-crystal" || safeIcon === "radiant-crystal") && (
        <>
          {oneChevron}
          {wings}
        </>
      )}
      {safeIcon === "radiant-crystal" && (
        <>
          {rays}
          {sparkles}
        </>
      )}
    </svg>
  );
}
