// Renders a printout as raw ESC/POS bytes for the Blueprint ECO80D (80mm
// paper, 48 columns per line at Font A — measured on the real printer with the
// Tes Lebar Kolom, and it uses the FULL paper width: never reduce it to a
// margin). WHAT the paper says (line order, labels, date/time format, which
// name goes with which price) comes from receipt-layout.ts, which the on-screen
// preview (paper-view.tsx) reads too; this file only decides how each line is
// drawn with ESC/POS (bold/size commands, right-aligned prices, the raster
// logo). Both WebBluetoothPrinter and RawBtPrinter ship exactly these bytes.
//
// Emphasis is BOLD ONLY (ESC E). Measured on the real ECO80D (Tes Ketajaman,
// 20 Sep 2026): normal and bold text are crisp, but every double-height /
// double-width variant smears — and the heating/density commands (ESC 7,
// DC2 #) changed nothing at all, so this printer ignores them. Do not bring
// ESC ! size bits back without re-testing on paper.
//
// The web Bluetooth and RawBT raw passes are byte streams, not RawBT text
// mode, so all text is sanitised to single-byte ASCII first: Indonesian text
// is almost entirely ASCII, and the remaining Latin-1 / typographic chars
// are folded to their nearest ASCII lookalike instead of being sent raw as
// UTF-8 (which prints garble on an ESC/POS code page). Unmappable chars
// (emoji, etc.) become "?". This is the safe-enough choice for a thermal
// receipt; the copy on the database and screen is never touched.

import type { LogoRaster, PackingListData, ReceiptData } from "./types";
import { RECEIPT_CHARS_PER_LINE } from "./paper";
import {
  buildPackingListLayout,
  buildReceiptLayout,
  type LayoutLine,
  type TextRole,
} from "./receipt-layout";

// Latin-1 and common typographic chars Wisconsin-style folded onto ASCII so
// a 1-bit thermal code page can actually print them. Anything unmapped
// becomes "?".
const NON_ASCII_FOLD: Record<string, string> = {
  é: "e", è: "e", ê: "e", ë: "e",
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y",
  ñ: "n", ç: "c", ø: "o", æ: "ae", ß: "ss",
  "’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"',
  "–": "-", "—": "-", "…": "...", "•": "*",
  "×": "x", "÷": "/", "±": "+-", "°": " ", "²": "2", "³": "3",
  "½": "1/2", "¼": "1/4", "¾": "3/4", "€": "EUR", "£": "GBP",
};

// Keeps \n (we emit it ourselves for line breaks) and ASCII printable,
// folds the above, and drops \r outright.
function sanitizeText(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch === "\n") {
      out += "\n";
      continue;
    }
    if (ch === "\r") continue;
    const code = ch.codePointAt(0);
    if (code != null && code >= 0x20 && code <= 0x7e) {
      out += ch;
      continue;
    }
    out += NON_ASCII_FOLD[ch] ?? "?";
  }
  return out;
}

const ESC = 0x1b;

// ESC/POS raster image: GS v 0 m xL xH yL yH d… — x = bytes per row
// (widthDots/8), y = height in dots, data scanned row-major with each byte
// packing 8 horizontal dots, bit0 = leftmost. Sorted black dots print first
// (reversed packing = the classic mistake that renders a mirror image).
function buildRasterBytes(widthDots: number, heightDots: number, data: Uint8Array): Uint8Array {
  const bytesPerRow = widthDots / 8;
  const header = Uint8Array.from([
    0x1d, 0x76, 0x30, 0x00, // GS v 0, m=0
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    heightDots & 0xff,
    (heightDots >> 8) & 0xff,
  ]);
  return concat(header, data);
}

const INIT = Uint8Array.from([ESC, 0x40]); // ESC @ — reset printer
const JUSTIFY_LEFT = Uint8Array.from([ESC, 0x61, 0]); // ESC a 0
const JUSTIFY_CENTER = Uint8Array.from([ESC, 0x61, 1]); // ESC a 1
const BOLD_ON = Uint8Array.from([ESC, 0x45, 1]); // ESC E 1
const BOLD_OFF = Uint8Array.from([ESC, 0x45, 0]); // ESC E 0

// ESC ! 0 — Font A, no size bits. Sent once at the top of every diagnostic
// page to make the starting state explicit; nothing here ever sets a size
// bit, so it never has to be undone mid-receipt.
const FONT_NORMAL = Uint8Array.from([ESC, 0x21, 0x00]);

// Feed the paper up n blank lines. The ECO80D's cutter is MANUAL
// ("Potongan kertas: not supported" in RawBT), so we never send a GS V cut
// command — just space the next/mounted receipt off the thermal head.
function feed(n: number): Uint8Array {
  return Uint8Array.from([ESC, 0x64, n]);
}

// No TextEncoder here on purpose: every character is guaranteed ASCII, and
// each code unit maps 1:1 to one printed column (12x24 dot font, 48 cols).
function asciiBytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i);
  return out;
}

function text(value: string): Uint8Array {
  return asciiBytes(sanitizeText(value));
}

function line(value = ""): Uint8Array {
  return text(`${value}\n`);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// "Multiplier x2" ............ "Rp22.000" — value glued to the right edge.
// If label + value overflow the line they are split onto two lines
// (label, then value right-aligned) instead of silently wrapping the price
// halfway across the paper. Newline inside the return is intended — line()
// appends the terminating \n and sanitizeText preserves interior \n.
function rightLine(label: string, value: string): string {
  const cols = RECEIPT_CHARS_PER_LINE;
  if (label.length + value.length + 1 <= cols) {
    return `${label}${" ".repeat(cols - label.length - value.length)}${value}`;
  }
  return `${label}\n${value.padStart(cols, " ")}`;
}

// "No. Order" : 67 — label column fixed at 10 chars, same as the preview's
// MetaRow (10ch monospace width), so the colons line up down the block.
function metaLine(label: string, value: string): string {
  return `${label.padEnd(10)}: ${value}`;
}

// Thermal emphasis lives here and only here, and it is bold and nothing else
// — the store name and the daftar packing title are bold at normal size.
function styledText(value: string, role: TextRole): Uint8Array[] {
  if (role === "title" || role === "heading") return [BOLD_ON, line(value), BOLD_OFF];
  return [line(value)];
}

// A name/value row whose value is emphasised: the Total, and the qty on a
// daftar packing. Bold only, so the columns still line up exactly like an
// ordinary rightLine row.
function boldValueRow(label: string, value: string): Uint8Array[] {
  return [BOLD_ON, line(rightLine(label, value)), BOLD_OFF];
}

function renderLayout(lines: LayoutLine[], logo: LogoRaster | null | undefined): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let centered = false;
  // ESC a only takes effect at the start of a line, and every line here ends
  // with LF, so switching between lines is always safe.
  const align = (center: boolean) => {
    if (center === centered) return;
    parts.push(center ? JUSTIFY_CENTER : JUSTIFY_LEFT);
    centered = center;
  };

  for (const item of lines) {
    switch (item.kind) {
      case "logo":
        if (!logo) break;
        align(true);
        parts.push(buildRasterBytes(logo.widthDots, logo.heightDots, logo.bytes));
        break;
      case "text":
        align(item.align === "center");
        parts.push(...styledText(item.text, item.role));
        break;
      case "blank":
        parts.push(line(""));
        break;
      case "rule":
        align(false);
        parts.push(line(item.text));
        break;
      case "meta":
        align(false);
        parts.push(line(metaLine(item.label, item.value)));
        break;
      case "pair":
        align(false);
        if (item.role === "total" || item.role === "qty") {
          parts.push(...boldValueRow(item.checkbox ? `[ ] ${item.left}` : item.left, item.right));
        } else {
          parts.push(line(rightLine(item.checkbox ? `[ ] ${item.left}` : item.left, item.right)));
        }
        break;
      case "sub":
        align(false);
        parts.push(line(` ${item.text}`));
        break;
    }
  }
  return parts;
}

// After the last line: feed the paper up so the cut/tear edge clears the print.
const END_FEED_LINES = 5;

export function buildReceiptBytes(data: ReceiptData): Uint8Array {
  return concat(INIT, ...renderLayout(buildReceiptLayout(data), data.logoRaster), feed(END_FEED_LINES));
}

export function buildPackingListBytes(data: PackingListData): Uint8Array {
  return concat(INIT, ...renderLayout(buildPackingListLayout(data), data.logoRaster), feed(END_FEED_LINES));
}

// "1234567890" repeated — count the last digit on the first physical row to
// read how many columns really fit before the printer wraps.
function digitRuler(cols: number): string {
  return "1234567890".repeat(Math.ceil(cols / 10)).slice(0, cols);
}

// "....5...10...15..." — every number ends exactly on its own column.
function markRuler(cols: number): string {
  let out = "";
  for (let n = 5; n <= cols; n += 5) out += String(n).padStart(5, ".");
  return out;
}

// "<-----...----->" exactly `width` wide: "<" is column 1, ">" is the last one.
function edgeMarker(width: number): string {
  return `<${"-".repeat(width - 2)}>`;
}

// Hardware diagnostic page, NOT a receipt (Pengaturan → "Tes Lebar Kolom").
// It goes through the same byte pipeline as a struk, so what it shows on
// paper is what a real struk gets. Measured on the real ECO80D (2026-09-20):
// Font A = 48 columns (T0 = T1: the power-on font is Font A), a 48-column row
// + LF leaves no extra blank row, the size commands are undone, and no byte is
// lost across 512-byte BLE frames. Kept so the check can be repeated after any
// change to the print pipeline or on a second printer. (It only covers ~2.5 KB
// though — the logo raster is the big transfer, and a dropped frame there
// shows up as a horizontally shifted row inside the bowl.) Per section:
//  T0/T1  how many columns fit in the default font (no ESC ! sent before T0)
//         and in Font A — count the last digit on the first physical row;
//  T2     where a 47/48/49-column row wraps, and whether a full 48-column row
//         followed by LF leaves an extra blank row;
//  T3     whether the emphasis the struk uses (bold title, bold Total) is
//         really undone before the next row;
//  T4     numbered full-width rows shaped like the item block (a short
//         add-on-like row between full rows) — left number must equal the
//         right number. Each row also prints its byte offset, and "*" marks a
//         row that straddles a 512-byte BLE frame boundary.
// (Font B via ESC ! 1 is not tested: this printer ignores that font bit.)
export function buildColumnTestBytes(): Uint8Array {
  const cols = RECEIPT_CHARS_PER_LINE;
  const parts: Uint8Array[] = [];
  const push = (...next: Uint8Array[]) => parts.push(...next);
  const size = () => parts.reduce((total, part) => total + part.length, 0);

  push(INIT, JUSTIFY_LEFT);
  push(line("TES LEBAR KOLOM"));

  push(line("[T0] font bawaan (tanpa ESC !)"), line(digitRuler(60)), line(markRuler(60)));
  push(FONT_NORMAL, line("[T1] Font A (ESC ! 0)"), line(digitRuler(60)), line(markRuler(60)));

  push(
    line("[T2] batas lebar (< kolom 1, > ujung)"),
    line("47:"),
    line(edgeMarker(47)),
    line("48:"),
    line(edgeMarker(48)),
    line("49:"),
    line(edgeMarker(49)),
    line("akhir T2"),
  );

  // Same command sequences as the real struk: bold header title, then the
  // bold Total row. Both edge markers must still be exactly 48 wide — that is
  // what proves the emphasis was turned back off.
  push(line("[T3] setelah huruf tebal (harus 48)"), JUSTIFY_CENTER, ...styledText("NAMA WARUNG", "title"), JUSTIFY_LEFT);
  push(line(edgeMarker(cols)), ...boldValueRow("Total", "Rp47.000"), line(edgeMarker(cols)));

  push(line("[T4] nomor kiri harus = nomor kanan"));
  for (let n = 1; n <= 24; n++) {
    const tag = String(n).padStart(2, "0");
    const start = size();
    const straddlesFrame = Math.floor(start / 512) !== Math.floor((start + cols) / 512);
    const left = `${tag}${straddlesFrame ? "*" : " "}@${String(start).padStart(4, "0")} `;
    const right = ` ${tag}`;
    push(line(`${left}${".".repeat(cols - left.length - right.length)}${right}`));
    if (n % 5 === 1) push(line(" (baris pendek, tanpa kanan)"));
  }

  push(feed(END_FEED_LINES));
  return concat(...parts);
}
