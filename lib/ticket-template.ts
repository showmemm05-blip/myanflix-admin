/**
 * The Thai-style ticket template — a COPY of the phone's
 * `mobile/src/lottery/components/ticket/template.ts` (itself the typed form
 * of `docs/lottery-design-2026-10-13/app/art/thai/template-thai.json`), so
 * the admin's sample ticket and layout guide put every slot exactly where
 * the phone prints it. The phone file is the source: change a number there
 * (and in the JSON) first, then mirror it here. Fonts may differ between the
 * two; positions must not.
 *
 * Units (the JSON's own): x, y, w, h are fractions of the FRAME's width and
 * height; `sizeRel`, `letterSpacingRel` and `strokeRel` are fractions of the
 * frame's WIDTH. A layer is placed at x·W, y·H, w·W, h·H and its text set at
 * sizeRel·W, where W × H is the ticket box (always 1800 : 940) — in CSS,
 * left/top/width/height as percentages and font-size as `sizeRel × 100cqw`.
 */

/** The frame image's pixel size: every uploaded frame must be this shape (or exactly 2× it). */
export const TICKET_FRAME = { width: 1800, height: 940 } as const;
/** width ÷ height — the ticket box's only allowed aspect ratio. */
export const TICKET_ASPECT = TICKET_FRAME.width / TICKET_FRAME.height;
/** 3% of each side: every slot and field sits inside it (template-thai.json `safeMargin`). */
export const TICKET_SAFE_MARGIN = { x: 0.03, y: 0.03 } as const;

/** The built-in frame and the sample picture, served from `admin/public/lottery/`. */
export const BUILT_IN_FRAME_SRC = "/lottery/frame-thai.png";
export const SAMPLE_PICTURE_SRC = "/lottery/sample-picture.png";

/** The printed inks (the phone's `TICKET_INK`). */
export const TICKET_INK = {
  number: "#18181C",
  pink: "#CF2A5E",
  blue: "#2766C2",
  red: "#E0241D",
  orange: "#F0841C",
  stamp: "#2C2836",
  bars: "#111114",
  /** The QR stand-in's own white box. */
  qrPaper: "#FFFFFF",
} as const;

export interface TicketBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The phone's faces: Courier Prime 700, Archivo 700 / 900, Noto Sans Myanmar 700. */
export type TicketFace = "courier700" | "archivo700" | "archivo900" | "myanmar";

export interface TicketTextField extends TicketBox {
  face: TicketFace;
  sizeRel: number;
  letterSpacingRel: number;
  color: string;
  align: "center" | "right";
  /** Six equal cells, one character group per cell (number and its spelled digits share them). */
  cells?: true;
}

export const THAI_TEMPLATE = {
  id: "tpl-thai-style",
  version: 1,
  /** Changes each draw (admin): the picture slot. */
  picture: { x: 0.0356, y: 0.2723, w: 0.3556, h: 0.5191 } satisfies TicketBox,
  fields: {
    /** Each ticket: the six digits, numbering-machine spacing. */
    number: {
      x: 0.5089, y: 0.0617, w: 0.3778, h: 0.1149,
      face: "courier700", sizeRel: 0.08333, letterSpacingRel: 0, color: TICKET_INK.number, align: "center", cells: true,
    },
    /** Each ticket: one three-letter word per digit, under its digit. */
    digitWords: {
      x: 0.5089, y: 0.1766, w: 0.3778, h: 0.0426,
      face: "courier700", sizeRel: 0.02222, letterSpacingRel: 0, color: TICKET_INK.number, align: "center", cells: true,
    },
    /** Each draw: ၂၀၂၆ ခုနှစ် အောက်တိုဘာလ ၃၁ ရက် */
    dateMy: {
      x: 0.5089, y: 0.2255, w: 0.3778, h: 0.0723,
      face: "myanmar", sizeRel: 0.02222, letterSpacingRel: 0, color: TICKET_INK.pink, align: "center",
    },
    /** Each draw: 31 OCTOBER 2026 */
    dateEn: {
      x: 0.5089, y: 0.3, w: 0.3778, h: 0.0468,
      face: "archivo700", sizeRel: 0.02222, letterSpacingRel: 0.00067, color: TICKET_INK.blue, align: "center",
    },
    /** Each draw: the draw number, no padding (24). */
    drawNo: {
      x: 0.5133, y: 0.4426, w: 0.0944, h: 0.0702,
      face: "archivo900", sizeRel: 0.03333, letterSpacingRel: 0, color: TICKET_INK.pink, align: "center",
    },
    /** Each draw: #,##0 (the unit ကျပ် is printed under it in the frame). */
    price: {
      x: 0.0322, y: 0.8021, w: 0.1711, h: 0.0894,
      face: "archivo900", sizeRel: 0.04444, letterSpacingRel: 0, color: TICKET_INK.red, align: "center",
    },
    /** Each ticket: MFL-24-000184, right-aligned. */
    ticketId: {
      x: 0.6389, y: 0.4468, w: 0.2444, h: 0.0574,
      face: "courier700", sizeRel: 0.02556, letterSpacingRel: 0.00111, color: TICKET_INK.orange, align: "right",
    },
    /** Each ticket: the human-readable code under the barcode. */
    barcodeText: {
      x: 0.5089, y: 0.6617, w: 0.3778, h: 0.0468,
      face: "courier700", sizeRel: 0.02, letterSpacingRel: 0.00111, color: TICKET_INK.number, align: "center",
    },
  } satisfies Record<string, TicketTextField>,
  /** Each ticket: the bars fill the field edge to edge (the frame keeps the quiet zone). */
  barcode: { x: 0.5333, y: 0.5319, w: 0.3289, h: 0.1191 } satisfies TicketBox,
  /** Each ticket: a square in pixels (144 × 144 at 1800 wide) on its own white. */
  qr: { x: 0.4044, y: 0.2723, w: 0.08, h: 0.1532 } satisfies TicketBox,
  /**
   * Each draw: the hollow "stamped" draw number over the two dates — the only
   * allowed overlap, so it is drawn LAST.
   */
  overprint: {
    x: 0.5833, y: 0.2553, w: 0.2, h: 0.1404,
    face: "archivo900" as TicketFace, sizeRel: 0.09333, letterSpacingRel: 0.00222, strokeRel: 0.00167, opacity: 0.75,
    color: TICKET_INK.stamp,
  },
  /** Bottom to top (template-thai.json `layerOrder`); the frame image sits under all of them. */
  layerOrder: [
    "picture",
    "number",
    "digitWords",
    "dateMy",
    "dateEn",
    "drawNo",
    "price",
    "ticketId",
    "barcode",
    "barcodeText",
    "qr",
    "overprint",
  ],
} as const;

/** The ticket's spelled digits, index = digit (0 ZER … 9 NIN) — the phone's `DIGIT_WORDS`. */
export const DIGIT_WORDS = ["ZER", "ONE", "TWO", "THR", "FOU", "FIV", "SIX", "SEV", "EIG", "NIN"] as const;

const MY_DIGITS = "၀၁၂၃၄၅၆၇၈၉";
const MY_MONTHS = [
  "ဇန်နဝါရီ",
  "ဖေဖော်ဝါရီ",
  "မတ်",
  "ဧပြီ",
  "မေ",
  "ဇွန်",
  "ဇူလိုင်",
  "ဩဂုတ်",
  "စက်တင်ဘာ",
  "အောက်တိုဘာ",
  "နိုဝင်ဘာ",
  "ဒီဇင်ဘာ",
];
const EN_MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

/** "2026-10-31" → [2026, 10, 31]. A draw date is a calendar date, never an instant. */
function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-");
  return [Number(y), Number(m), Number(d)];
}

/** 1000 → "1,000" (the phone's `group`). */
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 2026 → "၂၀၂၆". */
function myanmarNumerals(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => MY_DIGITS.charAt(Number(d)));
}

/** The ticket's Burmese date line: "၂၀၂၆ ခုနှစ် အောက်တိုဘာလ ၃၁ ရက်". */
export function ticketDateMy(iso: string): string {
  const [y, m, d] = ymd(iso);
  const month = MY_MONTHS[m - 1];
  return month ? `${myanmarNumerals(y)} ခုနှစ် ${month}လ ${myanmarNumerals(d)} ရက်` : "";
}

/** The ticket's English date line: "31 OCTOBER 2026". */
export function ticketDateEn(iso: string): string {
  const [y, m, d] = ymd(iso);
  const month = EN_MONTHS[m - 1];
  return month ? `${d} ${month} ${y}` : "";
}

/**
 * The human-readable line under the barcode (the phone's `barcodeCode`):
 * YYMMDD of the draw + the draw number (2 digits) + the six-digit number +
 * "-" + the ticket's 6-digit sequence → "26103124372694-000184".
 */
export function ticketBarcodeCode(drawNo: number, drawIso: string, ticketId: string, number: string): string {
  const [y, m, d] = ymd(drawIso);
  const sequence = ticketId.split("-").pop() ?? "";
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${String(y).slice(2)}${pad2(m)}${pad2(d)}${pad2(drawNo)}${number}-${sequence}`;
}

const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 " +
  "232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121"
).split(" ");

/**
 * The barcode STAND-IN (the phone's `barcodePath`): one SVG path of bars
 * for viewBox `0 0 {width} 40`, stretched to its field. It looks like Code
 * 128 and is not scannable — the preview only shows where the bars print.
 */
export function ticketBarcodePath(code: string): { d: string; width: number } {
  const seq = ["211214"];
  let sum = 104;
  for (let i = 0; i < code.length; i++) {
    const v = code.charCodeAt(i) - 32;
    seq.push(C128[(v * 7 + i * 3) % 48]);
    sum += v * (i + 1);
  }
  seq.push(C128[sum % 48]);
  seq.push("2331112");
  const widths = seq.join("").split("").map(Number);
  let x = 0;
  let d = "";
  for (let i = 0; i < widths.length; i++) {
    if (i % 2 === 0) d += `M${x} 0h${widths[i]}v40h-${widths[i]}z`;
    x += widths[i];
  }
  return { d, width: x };
}

/**
 * The QR STAND-IN (the phone's `qrPath`): 25 × 25 modules seeded by the
 * ticket ID, three finder squares, timing lines and one alignment square,
 * with a 2-module quiet zone → one path for viewBox `0 0 29 29`. Not
 * scannable.
 */
export function ticketQrPath(id: string): string {
  const n = 25;
  let s = 2166136261;
  for (let i = 0; i < id.length; i++) s = Math.imul(s ^ id.charCodeAt(i), 16777619);
  s >>>= 0;
  const rnd = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const m: number[][] = [];
  const fixed: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    m.push(new Array<number>(n).fill(0));
    fixed.push(new Array<boolean>(n).fill(false));
  }
  const finder = (r0: number, c0: number) => {
    for (let a = -1; a <= 7; a++) {
      for (let b = -1; b <= 7; b++) {
        const rr = r0 + a;
        const cc = c0 + b;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const ring = a === 0 || a === 6 || b === 0 || b === 6;
        const core = a >= 2 && a <= 4 && b >= 2 && b <= 4;
        m[rr][cc] = a >= 0 && a <= 6 && b >= 0 && b <= 6 && (ring || core) ? 1 : 0;
        fixed[rr][cc] = true;
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = m[i][6] = i % 2 ? 0 : 1;
    fixed[6][i] = fixed[i][6] = true;
  }
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      m[18 + r][18 + c] = Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1;
      fixed[18 + r][18 + c] = true;
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (!fixed[r][c]) m[r][c] = rnd() < 0.48 ? 1 : 0;
  }
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + 2} ${r + 2}h1v1h-1z`;
  }
  return d;
}
