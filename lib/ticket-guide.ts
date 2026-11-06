/**
 * The ticket LAYOUT GUIDE — a PNG built in the browser (HTMLCanvas, no
 * dependency) that a designer lays over a new frame: the frame's size, the
 * 3% safe margin and every live slot of the Thai-style template as a
 * labelled box, at the template's own fractions (lib/ticket-template.ts).
 * Everything outside the boxes is the designer's; everything inside is
 * printed by the app on top of the frame and must stay clear.
 *
 * The labels are English only: the guide is a designer's file, not a page,
 * and a canvas cannot promise the Burmese font is loaded when it draws.
 */
import { THAI_TEMPLATE, TICKET_FRAME, TICKET_SAFE_MARGIN, type TicketBox } from "@/lib/ticket-template";

/** The file name the browser saves the guide under. */
export const GUIDE_FILE_NAME = "myanflix-ticket-layout-guide-1800x940.png";

interface GuideBox {
  box: TicketBox;
  label: string;
  /** Who fills it: the admin once per draw, or the app once per ticket. */
  scope: "draw" | "ticket";
  /** The box's own hue, so neighbours read apart. */
  hue: number;
  /** Dashed: the one layer allowed to overlap others. */
  dashed?: true;
}

const GUIDE_BOXES: GuideBox[] = [
  { box: THAI_TEMPLATE.picture, label: "Picture", scope: "draw", hue: 150 },
  { box: THAI_TEMPLATE.fields.number, label: "Number", scope: "ticket", hue: 215 },
  { box: THAI_TEMPLATE.fields.digitWords, label: "Digit words", scope: "ticket", hue: 215 },
  { box: THAI_TEMPLATE.fields.dateMy, label: "Date (Burmese)", scope: "draw", hue: 330 },
  { box: THAI_TEMPLATE.fields.dateEn, label: "Date (English)", scope: "draw", hue: 330 },
  { box: THAI_TEMPLATE.fields.drawNo, label: "Draw number", scope: "draw", hue: 285 },
  { box: THAI_TEMPLATE.fields.ticketId, label: "Ticket ID", scope: "ticket", hue: 30 },
  { box: THAI_TEMPLATE.barcode, label: "Barcode", scope: "ticket", hue: 0 },
  { box: THAI_TEMPLATE.fields.barcodeText, label: "Barcode text", scope: "ticket", hue: 0 },
  { box: THAI_TEMPLATE.qr, label: "QR", scope: "ticket", hue: 190 },
  { box: THAI_TEMPLATE.fields.price, label: "Price", scope: "draw", hue: 15 },
  { box: THAI_TEMPLATE.overprint, label: "Stamp (over the dates)", scope: "draw", hue: 260, dashed: true },
];

/** A box's pixel frame at the guide's size. */
function px(box: TicketBox): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(box.x * TICKET_FRAME.width),
    y: Math.round(box.y * TICKET_FRAME.height),
    w: Math.round(box.w * TICKET_FRAME.width),
    h: Math.round(box.h * TICKET_FRAME.height),
  };
}

/**
 * Draws the guide on a fresh 1800 × 940 canvas and resolves to its PNG.
 * Rejects when the browser gives no 2D context or no blob (a very old or a
 * locked-down browser).
 */
export function buildLayoutGuide(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = TICKET_FRAME.width;
  canvas.height = TICKET_FRAME.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No 2D canvas"));

  const { width: W, height: H } = TICKET_FRAME;

  // Light paper, a fine grid every 100 px so a designer can read positions.
  ctx.fillStyle = "#FBF8F1";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(60, 50, 40, 0.07)";
  ctx.lineWidth = 1;
  for (let x = 100; x < W; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 100; y < H; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // The safe margin: 3% of each side, dashed.
  const mx = Math.round(TICKET_SAFE_MARGIN.x * W);
  const my = Math.round(TICKET_SAFE_MARGIN.y * H);
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = "rgba(60, 50, 40, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + 1, my + 1, W - 2 * mx - 2, H - 2 * my - 2);
  ctx.setLineDash([]);

  // Every live slot as a tinted, labelled box.
  for (const { box, label, scope, hue, dashed } of GUIDE_BOXES) {
    const r = px(box);
    ctx.fillStyle = dashed ? "transparent" : `hsla(${hue}, 70%, 55%, 0.18)`;
    if (!dashed) ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = `hsl(${hue}, 60%, 40%)`;
    ctx.lineWidth = 3;
    if (dashed) ctx.setLineDash([10, 8]);
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    ctx.setLineDash([]);

    // The label sits inside when the box is tall enough, else just above it.
    const inside = r.h >= 60;
    const fontPx = inside && r.h >= 120 ? 28 : 20;
    ctx.font = `700 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = `hsl(${hue}, 60%, 28%)`;
    const text = `${label} · ${scope === "draw" ? "per draw" : "per ticket"}`;
    const tx = r.x + 10;
    const ty = inside ? r.y + 8 : r.y - fontPx - 6;
    ctx.fillText(text, tx, ty, r.w - 20);
    if (inside && r.h >= 120) {
      ctx.font = `500 18px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillStyle = `hsla(${hue}, 60%, 28%, 0.85)`;
      ctx.fillText(`${r.w} × ${r.h} px at (${r.x}, ${r.y})`, tx, ty + fontPx + 6, r.w - 20);
    }
  }

  // The reading lines, in the top-left corner the template leaves clear
  // (above the picture, left of the number).
  const textLeft = mx + 8;
  const textWidth = Math.round(THAI_TEMPLATE.fields.number.x * W) - textLeft - 24;
  ctx.font = `700 24px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(40, 32, 26, 0.9)";
  ctx.fillText(`MyanFlix ticket frame · ${W} × ${H} px (or exactly 2×: ${W * 2} × ${H * 2})`, textLeft, my + 34, textWidth);
  ctx.font = `500 20px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(40, 32, 26, 0.75)";
  ctx.fillText("Keep every box clear: the app prints there.", textLeft, my + 66, textWidth);
  ctx.fillText("Dashed = the 3% safe margin. Everything else is yours to draw.", textLeft, my + 94, textWidth);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No PNG from the canvas"))), "image/png");
  });
}
