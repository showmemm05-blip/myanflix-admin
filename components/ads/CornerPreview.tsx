"use client";

import { memo, type CSSProperties } from "react";
import Image from "next/image";
import { Link2, X } from "lucide-react";
import { useLanguage } from "@/lib/context/language-context";
import { linkHost } from "@/components/ads/adForm";

/** The players' corner box, as shares of the frame: at most a quarter of its width and a fifth of its height. */
const MAX_WIDTH_SHARE = 0.25;
const MAX_HEIGHT_SHARE = 0.2;
const FRAME_ASPECT = 16 / 9;

/**
 * The frame stands for a player this many pixels wide, so a small picture
 * (a 120 px badge) is shown at its real share rather than blown up to fill
 * the whole corner box.
 */
const REFERENCE_PLAYER_WIDTH = 1280;

/** The picture's box in the frame: fitted in the corner box keeping its shape, as % of the frame's width. */
function pictureBox(width: number | null, height: number | null): CSSProperties {
  if (!width || !height) return { width: `${MAX_WIDTH_SHARE * 100}%`, height: `${MAX_HEIGHT_SHARE * 100}%` };
  // A fifth of the frame's height, in frame widths, times the picture's shape.
  const byHeight = (MAX_HEIGHT_SHARE / FRAME_ASPECT) * (width / height);
  const share = Math.min(MAX_WIDTH_SHARE, byHeight, width / REFERENCE_PLAYER_WIDTH);
  return { width: `${share * 100}%`, aspectRatio: `${width} / ${height}` };
}

interface CornerPreviewProps {
  /** The picture (a local object URL before saving, the stored URL after); null = none yet. */
  src: string | null;
  /** Its size in pixels, when known — the box keeps its shape. */
  width: number | null;
  height: number | null;
  closable: boolean;
  linkUrl: string | null;
  /** The timing in one line under the frame; left out when the page says it elsewhere (the wizard's timing step). */
  timeline?: string;
  /** A line under the frame ("Preview — top right, about this size on a big screen."). */
  caption?: string;
  /**
   * When the players hide the picture; on by default. The wizard's timing
   * step lists its own notes and turns it off.
   */
  showHiddenNote?: boolean;
  title: string;
}

/**
 * How a corner ad sits on the player, before anything is saved: a dark 16:9
 * frame with the picture in the top-right corner (12 px in, at most a
 * quarter of the width and a fifth of the height, as the players place
 * it), the "Ad" tag, the ✕ when viewers can close it, and the link it
 * opens. Memoised with primitive props, so typing in the form's other boxes
 * does not repaint the picture.
 */
export const CornerPreview = memo(function CornerPreview({
  src,
  width,
  height,
  closable,
  linkUrl,
  timeline,
  caption,
  showHiddenNote = true,
  title,
}: CornerPreviewProps) {
  const { t } = useLanguage();
  const p = t.adsUi.wizard.preview;
  const host = linkHost(linkUrl);

  return (
    <figure className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={p.label}
        className="relative aspect-video w-full overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[radial-gradient(ellipse_at_30%_70%,#2a2f3a_0%,#0b0c10_70%)]"
      >
        <span className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.3em] text-white/20">
          {p.theMovie}
        </span>
        <div className="absolute right-3 top-3" style={pictureBox(width, height)}>
          {src ? (
            <Image
              key={src}
              src={src}
              alt={title ? t.ads.thumbnailAlt(title) : ""}
              fill
              sizes="320px"
              unoptimized
              className="object-contain"
            />
          ) : (
            <span className="flex size-full items-center justify-center rounded border border-dashed border-white/40 text-center text-[10px] text-white/60">
              {p.placeholder}
            </span>
          )}
          <span className="absolute bottom-0.5 left-0.5 rounded-sm bg-black/75 px-1 text-[9px] font-semibold uppercase leading-4 text-white">
            {p.adTag}
          </span>
          {closable && (
            <span
              className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-black/85 text-white ring-1 ring-white/30"
              title={p.close}
            >
              <X className="size-2.5" aria-hidden />
            </span>
          )}
          {host && (
            <span className="absolute right-0 top-full mt-1 flex max-w-40 items-center gap-1 whitespace-nowrap rounded-sm bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
              <Link2 className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{host}</span>
            </span>
          )}
        </div>
      </div>
      {(caption || timeline || showHiddenNote) && (
        <figcaption className="flex flex-col gap-1">
          {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
          {timeline && <span className="text-xs text-muted-foreground">{timeline}</span>}
          {showHiddenNote && <span className="text-[11px] text-muted-foreground">{p.hiddenNote}</span>}
        </figcaption>
      )}
    </figure>
  );
});
