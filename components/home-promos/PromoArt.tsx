import type { HomePromoArtPreset } from "@/types/home-promo";
import { cn } from "@/lib/utils";

/**
 * The four drawn backgrounds a promo can use instead of an uploaded image.
 * PREMIUM, PAYMENT and GAMES are the flat scenes from the approved Home
 * showcase boards (docs/home-showcase-2026-10-08/design/HomeWeb.dc.html,
 * same 1440x810 canvas, same paths and colours) so what the admin previews
 * is what the apps draw. GENERIC is the neutral one for everything else: a
 * crimson glow behind three stacked posters.
 */

const GOLD = "#F5C451";
const GREEN = "#2FD07E";
const CRIMSON = "#E0181F";

interface Scene {
  bg: string;
  glow: string;
  sx: number;
  sy: number;
  sr: number;
  dots: { cx: number; cy: number; r: number; fill: string; op: number }[];
  shapes: { d: string; fill: string; op: number }[];
}

const card = (x: number, y: number) =>
  `M${x} ${y} h300 a24 24 0 0 1 24 24 v180 a24 24 0 0 1 -24 24 h-300 a24 24 0 0 1 -24 -24 v-180 a24 24 0 0 1 24 -24 z`;
const poster = (x: number, y: number) =>
  `M${x} ${y} h200 a20 20 0 0 1 20 20 v280 a20 20 0 0 1 -20 20 h-200 a20 20 0 0 1 -20 -20 v-280 a20 20 0 0 1 20 -20 z`;

export const PROMO_SCENES: Record<HomePromoArtPreset, Scene> = {
  PREMIUM: {
    bg: "#1A1408",
    glow: GOLD,
    sx: 1040,
    sy: 330,
    sr: 110,
    dots: [
      { cx: 760, cy: 180, r: 5, fill: GOLD, op: 0.8 },
      { cx: 1290, cy: 150, r: 4, fill: GOLD, op: 0.7 },
      { cx: 1330, cy: 420, r: 6, fill: GOLD, op: 0.5 },
      { cx: 820, cy: 420, r: 3, fill: GOLD, op: 0.7 },
    ],
    shapes: [
      { d: "M0 620 C260 600 520 630 780 590 C1000 560 1220 580 1440 570 V810 H0 Z", fill: "#2A2010", op: 1 },
      { d: "M840 490 H1240 L1272 260 L1140 352 L1040 190 L940 352 L808 260 Z", fill: GOLD, op: 0.95 },
      { d: "M840 490 H1240 V530 H840 Z", fill: "#B8860B", op: 1 },
      { d: "M0 700 H1440 V810 H0 Z", fill: "#0E0B05", op: 1 },
    ],
  },
  PAYMENT: {
    bg: "#0B1F17",
    glow: GREEN,
    sx: 1060,
    sy: 300,
    sr: 100,
    dots: [
      { cx: 1300, cy: 520, r: 26, fill: GOLD, op: 0.9 },
      { cx: 1340, cy: 560, r: 26, fill: GOLD, op: 0.7 },
      { cx: 760, cy: 560, r: 22, fill: GREEN, op: 0.6 },
    ],
    shapes: [
      { d: "M0 640 C300 610 600 640 900 600 C1100 574 1300 586 1440 576 V810 H0 Z", fill: "#0E2A20", op: 1 },
      { d: card(880, 400), fill: "#1D4A3A", op: 1 },
      { d: card(920, 360), fill: GREEN, op: 0.9 },
      { d: card(960, 320), fill: GOLD, op: 0.95 },
      { d: "M960 372 h348 v40 h-348 z", fill: "#1F1600", op: 0.35 },
      { d: "M0 720 H1440 V810 H0 Z", fill: "#061511", op: 1 },
    ],
  },
  GAMES: {
    bg: "#180A0D",
    glow: CRIMSON,
    sx: 1040,
    sy: 330,
    sr: 120,
    dots: [
      { cx: 1120, cy: 390, r: 14, fill: GREEN, op: 1 },
      { cx: 1160, cy: 430, r: 14, fill: GOLD, op: 1 },
      { cx: 1080, cy: 430, r: 14, fill: "#FF4D55", op: 1 },
      { cx: 1120, cy: 470, r: 14, fill: "#4DB3FF", op: 1 },
    ],
    shapes: [
      { d: "M0 660 H1440 V810 H0 Z", fill: "#0B0507", op: 1 },
      {
        d: "M846 520 L892 316 Q910 268 962 268 H1118 Q1170 268 1188 316 L1234 520 Q1244 590 1188 590 Q1134 590 1098 520 L1064 462 H1016 L982 520 Q946 590 892 590 Q836 590 846 520 Z",
        fill: CRIMSON,
        op: 0.55,
      },
      {
        d: "M860 510 L900 330 Q916 290 960 290 H1120 Q1164 290 1180 330 L1220 510 Q1228 570 1180 570 Q1132 570 1100 510 L1070 460 H1010 L980 510 Q948 570 900 570 Q852 570 860 510 Z",
        fill: "#2B1116",
        op: 1,
      },
      { d: "M950 380 h24 v34 h34 v24 h-34 v34 h-24 v-34 h-34 v-24 h34 z", fill: GOLD, op: 1 },
    ],
  },
  GENERIC: {
    bg: "#101016",
    glow: CRIMSON,
    sx: 1080,
    sy: 320,
    sr: 110,
    dots: [
      { cx: 780, cy: 200, r: 4, fill: "#FFFFFF", op: 0.5 },
      { cx: 1320, cy: 170, r: 5, fill: "#FFFFFF", op: 0.4 },
      { cx: 1350, cy: 470, r: 4, fill: "#FF4D55", op: 0.6 },
    ],
    shapes: [
      { d: "M0 640 C300 612 620 644 920 604 C1120 578 1300 590 1440 580 V810 H0 Z", fill: "#16161D", op: 1 },
      { d: poster(900, 250), fill: "#2A2A33", op: 1 },
      { d: poster(980, 220), fill: "#3A3A44", op: 1 },
      { d: poster(1060, 190), fill: CRIMSON, op: 0.9 },
      { d: "M1140 300 L1200 340 L1140 380 Z", fill: "#FFFFFF", op: 0.9 },
      { d: "M0 720 H1440 V810 H0 Z", fill: "#0A0A0E", op: 1 },
    ],
  },
};

/** The preset drawn full-bleed, cropped like the apps crop it (slice, centred). */
export function PromoArt({
  preset,
  className,
}: {
  preset: HomePromoArtPreset;
  className?: string;
}) {
  const scene = PROMO_SCENES[preset];
  return (
    <svg
      viewBox="0 0 1440 810"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("absolute inset-0 size-full", className)}
    >
      <rect width="1440" height="810" fill={scene.bg} />
      <circle cx={scene.sx} cy={scene.sy} r="280" fill={scene.glow} opacity="0.12" />
      <circle cx={scene.sx} cy={scene.sy} r={scene.sr} fill={scene.glow} />
      {scene.dots.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} opacity={dot.op} />
      ))}
      {scene.shapes.map((shape, i) => (
        <path key={i} d={shape.d} fill={shape.fill} opacity={shape.op} />
      ))}
    </svg>
  );
}
