"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  BUILT_IN_FRAME_SRC,
  DIGIT_WORDS,
  SAMPLE_PICTURE_SRC,
  THAI_TEMPLATE,
  TICKET_FRAME,
  TICKET_INK,
  groupDigits,
  ticketBarcodeCode,
  ticketBarcodePath,
  ticketDateEn,
  ticketDateMy,
  ticketQrPath,
  type TicketBox,
  type TicketFace,
  type TicketTextField,
} from "@/lib/ticket-template";

/** What the ticket prints about its draw. */
export interface TicketPreviewDraw {
  drawNo: number;
  /** "YYYY-MM-DD", the Thai lottery's own date. */
  thaiDrawDate: string;
  ticketPrice: number;
}

/** The sample ticket's own print — the design boards' example ticket. */
export const SAMPLE_TICKET_NUMBER = "372694";
export function sampleTicketId(drawNo: number): string {
  return `MFL-${drawNo}-000184`;
}

interface TicketPreviewProps {
  /** The frame image; null = the built-in frame. One that will not load falls back to the built-in. */
  frameUrl: string | null;
  /** The draw's picture; null = the sample picture (what the phone prints for a draw without one). */
  pictureUrl: string | null;
  draw: TicketPreviewDraw;
  /** Six digits as a string; the sample number by default. */
  number?: string;
  /** MFL-24-000184; the sample ID by default. */
  ticketId?: string;
  /** The spoken description of the whole picture; the layers are decorative. */
  label: string;
  className?: string;
}

/**
 * The sample ticket, as the phone prints one: the frame under everything,
 * the picture in its window, then the live layers at the template's own
 * fractions (lib/ticket-template.ts). Every position is a percentage of the
 * box and every text size a fraction of the box's width (`cqw`), so the
 * ticket scales with whatever width its parent gives it and nothing is ever
 * cropped or stretched — the box is always 1800 : 940. The fonts are the
 * admin's (the phone bundles Courier Prime and Archivo); the positions are
 * the same.
 */
export function TicketPreview({
  frameUrl,
  pictureUrl,
  draw,
  number = SAMPLE_TICKET_NUMBER,
  ticketId = sampleTicketId(draw.drawNo),
  label,
  className,
}: TicketPreviewProps) {
  // A remote image that will not load falls back to the bundled one (remembered per URL, like the phone).
  const [failedFrame, setFailedFrame] = useState<string | null>(null);
  const [failedPicture, setFailedPicture] = useState<string | null>(null);
  const frameSrc = frameUrl && failedFrame !== frameUrl ? frameUrl : BUILT_IN_FRAME_SRC;
  const pictureSrc = pictureUrl && failedPicture !== pictureUrl ? pictureUrl : SAMPLE_PICTURE_SRC;

  const art = useMemo(() => {
    const code = ticketBarcodeCode(draw.drawNo, draw.thaiDrawDate, ticketId, number);
    return { code, bars: ticketBarcodePath(code), qr: ticketQrPath(ticketId) };
  }, [draw.drawNo, draw.thaiDrawDate, ticketId, number]);

  const fields = THAI_TEMPLATE.fields;
  const digits = number.padEnd(6).slice(0, 6).split("");
  const words = digits.map((digit) => (/\d/.test(digit) ? DIGIT_WORDS[Number(digit)] : ""));
  const ov = THAI_TEMPLATE.overprint;

  return (
    <div role="img" aria-label={label} className={cn("w-full @container", className)}>
      <div
        aria-hidden
        className="relative w-full select-none overflow-hidden rounded-sm bg-[#FBF7EE] shadow-[var(--shadow-e1)]"
        style={{ aspectRatio: `${TICKET_FRAME.width} / ${TICKET_FRAME.height}` }}
      >
        <Image
          key={frameSrc}
          src={frameSrc}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          draggable={false}
          className="object-contain"
          onError={() => frameUrl && setFailedFrame(frameUrl)}
        />
        <div style={place(THAI_TEMPLATE.picture)}>
          <Image
            key={pictureSrc}
            src={pictureSrc}
            alt=""
            fill
            sizes="50vw"
            unoptimized
            draggable={false}
            className="object-contain"
            onError={() => pictureUrl && setFailedPicture(pictureUrl)}
          />
        </div>

        <Cells field={fields.number} values={digits} />
        <Cells field={fields.digitWords} values={words} />
        <TextLayer field={fields.dateMy} text={ticketDateMy(draw.thaiDrawDate)} />
        <TextLayer field={fields.dateEn} text={ticketDateEn(draw.thaiDrawDate)} />
        <TextLayer field={fields.drawNo} text={String(draw.drawNo)} />
        <TextLayer field={fields.price} text={groupDigits(draw.ticketPrice)} />
        <TextLayer field={fields.ticketId} text={ticketId} />

        <div style={place(THAI_TEMPLATE.barcode)}>
          <svg
            viewBox={`0 0 ${art.bars.width} 40`}
            preserveAspectRatio="none"
            className="block h-full w-full"
          >
            <path d={art.bars.d} fill={TICKET_INK.bars} />
          </svg>
        </div>
        <TextLayer field={fields.barcodeText} text={art.code} />
        <div style={{ ...place(THAI_TEMPLATE.qr), backgroundColor: TICKET_INK.qrPaper }}>
          <svg viewBox="0 0 29 29" className="block h-full w-full">
            <path d={art.qr} fill={TICKET_INK.bars} />
          </svg>
        </div>

        {/* The hollow stamped draw number, LAST: the one allowed overlap (over the two dates). */}
        <div
          style={{
            ...place(ov),
            ...fontOf(ov),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            color: "transparent",
            WebkitTextStroke: `max(1px, ${ov.strokeRel * 100}cqw) ${ov.color}`,
            opacity: ov.opacity,
          }}
        >
          {String(draw.drawNo).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

/** A box as an absolute frame — percentages of the ticket box. */
function place(box: TicketBox): CSSProperties {
  return {
    position: "absolute",
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

/** The admin's stand-ins for the phone's faces: a monospace for Courier Prime, the sans for Archivo. */
const FACE_FAMILY: Record<TicketFace, string> = {
  courier700: "var(--font-geist-mono), ui-monospace, Menlo, monospace",
  archivo700: "var(--font-inter), system-ui, sans-serif",
  archivo900: "var(--font-inter), system-ui, sans-serif",
  myanmar: "var(--font-noto-myanmar), 'Noto Sans Myanmar', sans-serif",
};
const FACE_WEIGHT: Record<TicketFace, number> = { courier700: 700, archivo700: 700, archivo900: 900, myanmar: 700 };

/** Text at sizeRel × the box width, with the trailing letter-space cancelled so a centred run sits centred. */
function fontOf(field: Pick<TicketTextField, "face" | "sizeRel" | "letterSpacingRel" | "color">): CSSProperties {
  const tracking = `${field.letterSpacingRel * 100}cqw`;
  return {
    fontFamily: FACE_FAMILY[field.face],
    fontWeight: FACE_WEIGHT[field.face],
    fontSize: `${field.sizeRel * 100}cqw`,
    lineHeight: 1,
    letterSpacing: tracking,
    paddingLeft: tracking,
    color: field.color,
  };
}

/** One printed run, never wrapped, centred (or right-aligned) in its field. */
function TextLayer({ field, text }: { field: TicketTextField; text: string }) {
  return (
    <div
      style={{
        ...place(field),
        ...fontOf(field),
        display: "flex",
        alignItems: "center",
        justifyContent: field.align === "right" ? "flex-end" : "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {text}
    </div>
  );
}

/** Six equal columns, one value centred in each (the number and its words share them). */
function Cells({ field, values }: { field: TicketTextField; values: string[] }) {
  return (
    <div
      style={{
        ...place(field),
        ...fontOf(field),
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {values.map((value, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value}
        </span>
      ))}
    </div>
  );
}
