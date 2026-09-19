// Renders a printout as raw ESC/POS bytes for the Blueprint ECO80D (80mm
// paper, 48 columns per line at Font A — measured on the real printer with the
// Tes Lebar Kolom, and it uses the FULL paper width: never reduce it to a
// margin). WHAT the paper says (line order, labels, date/time format, which
// name goes with which price) comes from receipt-layout.ts, which the on-screen
// preview (paper-view.tsx) reads too; this file only decides how each line is
// drawn with ESC/POS (bold/size commands, right-aligned prices, the raster
// logo). Both WebBluetoothPrinter and RawBtPrinter ship exactly these bytes.
//
// The web Bluetooth and RawBT raw passes are byte streams, not RawBT text
// mode, so all text is sanitised to single-byte ASCII first: Indonesian text
// is almost entirely ASCII, and the remaining Latin-1 / typographic chars
// are folded to their nearest ASCII lookalike instead of being sent raw as
// UTF-8 (which prints garble on an ESC/POS code page). Unmappable chars
// (emoji, etc.) become "?". This is the safe-enough choice for a thermal
// receipt; the copy on the database and screen is never touched.

import type { LogoRaster, PackingListData, PrintTuning, ReceiptData } from "./types";
import { RECEIPT_CHARS_PER_LINE } from "./paper";
import { HEAT_DEFAULTS, NO_TUNING } from "./tuning";
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

// ESC ! character-style. Applies until the next ESC !:
// 0x00 = Font A normal, 0x10 = Font A double-height, 0x28 = Font A
// double-width + bold. Used for the store-name heading and the Total row
// (revisi: nama warung double-height + tebal, Total double-width + tebal).
const FONT_NORMAL = Uint8Array.from([ESC, 0x21, 0x00]);
const FONT_TITLE = Uint8Array.from([ESC, 0x21, 0x10]);
const FONT_WIDE_BOLD = Uint8Array.from([ESC, 0x21, 0x28]);

// Feed the paper up n blank lines. The ECO80D's cutter is MANUAL
// ("Potongan kertas: not supported" in RawBT), so we never send a GS V cut
// command — just space the next/mounted receipt off the thermal head.
function feed(n: number): Uint8Array {
  return Uint8Array.from([ESC, 0x64, n]);
}

// Thermal head tuning (see tuning.ts), sent right after ESC @ at the start of
// every job. Empty fields send nothing, so an untouched Setting changes no
// byte of the output. ESC 7 carries all three heating parameters at once; the
// ones the owner left empty fall back to the documented factory values.
export function tuningBytes(tuning: PrintTuning | null | undefined): Uint8Array[] {
  if (!tuning) return [];
  const parts: Uint8Array[] = [];
  if (tuning.heatDots != null || tuning.heatTime != null || tuning.heatInterval != null) {
    parts.push(escHeating(tuning));
  }
  if (tuning.density != null) parts.push(Uint8Array.from([0x12, 0x23, tuning.density & 0x1f])); // DC2 # n
  return parts;
}

// ESC 7 n1 n2 n3 with factory values filling any blank parameter.
function escHeating(tuning: PrintTuning): Uint8Array {
  return Uint8Array.from([
    ESC,
    0x37,
    tuning.heatDots ?? HEAT_DEFAULTS.heatDots,
    tuning.heatTime ?? HEAT_DEFAULTS.heatTime,
    tuning.heatInterval ?? HEAT_DEFAULTS.heatInterval,
  ]);
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

// Thermal emphasis lives here and only here: paper has no font-weight, so the
// store name is double-height + bold and the Total row double-width + bold.
// (If the printer turns out to smear bold + double-size together, this is the
// one place to change — the structure of the paper does not depend on it.)
function styledText(value: string, role: TextRole): Uint8Array[] {
  if (role === "title") return [FONT_TITLE, BOLD_ON, line(value), BOLD_OFF, FONT_NORMAL];
  if (role === "heading") return [BOLD_ON, line(value), BOLD_OFF];
  return [line(value)];
}

// The Total row: label double-width + bold (each glyph two columns wide, so
// its width is counted twice), value bold, still glued to the right edge.
function totalRow(label: string, value: string): Uint8Array[] {
  const spaces = Math.max(1, RECEIPT_CHARS_PER_LINE - label.length * 2 - value.length);
  return [FONT_WIDE_BOLD, text(label), FONT_NORMAL, text(" ".repeat(spaces)), BOLD_ON, text(value), text("\n"), BOLD_OFF];
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
        align(true);
        if (logo) parts.push(buildRasterBytes(logo.widthDots, logo.heightDots, logo.bytes));
        parts.push(line(item.caption));
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
        if (item.role === "total") parts.push(...totalRow(item.left, item.right));
        else parts.push(line(rightLine(item.checkbox ? `[ ] ${item.left}` : item.left, item.right)));
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
  return concat(INIT, ...tuningBytes(data.tuning), ...renderLayout(buildReceiptLayout(data), data.logoRaster), feed(END_FEED_LINES));
}

export function buildPackingListBytes(data: PackingListData): Uint8Array {
  return concat(INIT, ...tuningBytes(data.tuning), ...renderLayout(buildPackingListLayout(data), data.logoRaster), feed(END_FEED_LINES));
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
// change to the print pipeline or on a second printer. Per section:
//  T0/T1  how many columns fit in the default font (no ESC ! sent before T0)
//         and in Font A — count the last digit on the first physical row;
//  T2     where a 47/48/49-column row wraps, and whether a full 48-column row
//         followed by LF leaves an extra blank row;
//  T3     whether the size commands the struk uses (double-height title,
//         double-width Total) are really undone before the next row;
//  T4     numbered full-width rows shaped like the item block (a short
//         add-on-like row between full rows) — left number must equal the
//         right number. Each row also prints its byte offset, and "*" marks a
//         row that straddles a 512-byte BLE frame boundary.
// (Font B via ESC ! 1 is not tested: this printer ignores that font bit.)
export function buildColumnTestBytes(tuning?: PrintTuning): Uint8Array {
  const cols = RECEIPT_CHARS_PER_LINE;
  const parts: Uint8Array[] = [];
  const push = (...next: Uint8Array[]) => parts.push(...next);
  const size = () => parts.reduce((total, part) => total + part.length, 0);

  push(INIT, ...tuningBytes(tuning), JUSTIFY_LEFT);
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

  // Same command sequences as the real struk: header title, then the Total row.
  push(line("[T3] setelah huruf besar (harus 48)"), JUSTIFY_CENTER, ...styledText("NAMA 2xTINGGI", "title"), JUSTIFY_LEFT);
  push(line(edgeMarker(cols)), ...totalRow("Total", "Rp47.000"), line(edgeMarker(cols)));

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

const printMode = (n: number) => Uint8Array.from([ESC, 0x21, n]); // ESC ! n

// "titik=7 waktu=80 jeda=2" — the ESC 7 numbers exactly as they will be sent
// (blank parameters shown as their factory values).
function describeHeating(tuning: PrintTuning): string {
  const dots = tuning.heatDots ?? HEAT_DEFAULTS.heatDots;
  const time = tuning.heatTime ?? HEAT_DEFAULTS.heatTime;
  const interval = tuning.heatInterval ?? HEAT_DEFAULTS.heatInterval;
  return `titik=${dots} waktu=${time} jeda=${interval}`;
}

// Label for a profile of the sweep: ESC 7 is always sent there, DC2 # only
// when the profile sets a density.
function describeProfile(tuning: PrintTuning): string {
  return tuning.density != null ? `${describeHeating(tuning)} kepekatan=${tuning.density}` : describeHeating(tuning);
}

// What the saved settings send on every job: nothing at all when empty.
function describeSaved(tuning: PrintTuning): string {
  const parts: string[] = [];
  if (tuning.heatDots != null || tuning.heatTime != null || tuning.heatInterval != null) parts.push(describeHeating(tuning));
  if (tuning.density != null) parts.push(`kepekatan=${tuning.density}`);
  return parts.length ? parts.join(" ") : "bawaan printer";
}

// "Total ..... Rp47.000" in an arbitrary ESC ! mode, for the style comparison.
function sampleTotalRow(mode: number, boldLabel: boolean): Uint8Array[] {
  const label = "Total";
  const value = "Rp47.000";
  const wide = (mode & 0x20) !== 0;
  const spaces = Math.max(1, RECEIPT_CHARS_PER_LINE - label.length * (wide ? 2 : 1) - value.length);
  return [printMode(mode), ...(boldLabel ? [BOLD_ON] : []), text(label), FONT_NORMAL, BOLD_OFF, text(" ".repeat(spaces)), text(value), text("\n")];
}

// The combinations the Tes Ketajaman sweeps. Every ESC 7 profile fully
// specifies the three heating parameters (blank ones = factory values), so a
// profile never inherits the previous one's heating; density profiles come
// last because DC2 # stays in force until it is changed again.
const SHARPNESS_PROFILES: PrintTuning[] = [
  NO_TUNING, // ESC 7 with all factory values
  { ...NO_TUNING, heatTime: 120 },
  { ...NO_TUNING, heatTime: 160 },
  { ...NO_TUNING, heatTime: 200 },
  { ...NO_TUNING, heatDots: 3, heatTime: 120 },
  { ...NO_TUNING, heatTime: 120, heatInterval: 20 },
  { ...NO_TUNING, density: 8 },
  { ...NO_TUNING, density: 14 },
  { ...NO_TUNING, density: 22 },
];

// Hardware diagnostic page for print sharpness (Pengaturan → "Tes Ketajaman").
// Bold / double-size text smears on the ECO80D while normal text is crisp, so
// this prints, on ONE strip and through the real pipeline:
//  [G]   the same sample in every text style (normal, bold, double-height,
//        double-width, both, and the two combinations the struk uses), under
//        the saved tuning — shows whether the smear comes from a particular
//        style (e.g. bold + double-size together) rather than from heat;
//  [P0-] the same three sample rows under each heating/density combination,
//        each labelled with the exact numbers to type into Pengaturan.
// Pick the sharpest row, enter its numbers, save. A printer that does not know
// ESC 7 / DC2 # prints the parameter bytes as stray characters right under the
// profile label — that itself is the answer ("not supported").
export function buildSharpnessTestBytes(saved?: PrintTuning): Uint8Array {
  const parts: Uint8Array[] = [];
  const push = (...next: Uint8Array[]) => parts.push(...next);
  const current = saved ?? NO_TUNING;

  push(INIT, ...tuningBytes(saved), JUSTIFY_LEFT);
  push(line("TES KETAJAMAN"), line(`Tersimpan: ${describeSaved(current)}`));

  push(line("[G] gaya huruf"));
  push(line("G1 normal"), line(rightLine("2x Mie Ayam", "Rp34.000")));
  push(line("G2 tebal (ESC E)"), BOLD_ON, line(rightLine("2x Mie Ayam", "Rp34.000")), BOLD_OFF);
  push(line("G3 tinggi 2x"), printMode(0x10), line("NAMA WARUNG"), FONT_NORMAL);
  push(line("G4 lebar 2x"), ...sampleTotalRow(0x20, false));
  push(line("G5 lebar+tinggi 2x"), ...sampleTotalRow(0x30, false));
  push(line("G6 tinggi 2x + tebal (nama warung)"), ...styledText("NAMA WARUNG", "title"));
  push(line("G7 lebar 2x + tebal (Total)"), ...totalRow("Total", "Rp47.000"));

  SHARPNESS_PROFILES.forEach((profile, index) => {
    push(line(""), line(`[P${index}] ${describeProfile(profile)}`));
    push(escHeating(profile), ...(profile.density != null ? [Uint8Array.from([0x12, 0x23, profile.density & 0x1f])] : []));
    push(line(rightLine("2x Mie Ayam", "Rp34.000")));
    push(BOLD_ON, line(rightLine("Subtotal", "Rp47.000")), BOLD_OFF);
    push(...totalRow("Total", "Rp47.000"));
  });

  // Put the saved values back; anything a profile changed that the saved
  // tuning does not cover only clears when the printer is power-cycled.
  push(escHeating(current), ...tuningBytes(saved));
  push(line(""), line("Matikan-nyalakan printer setelah tes ini"));
  push(feed(END_FEED_LINES));
  return concat(...parts);
}
