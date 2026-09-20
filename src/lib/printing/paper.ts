// Single source of truth for the printer's paper width — every printed
// separator line derives its length from this instead of a hardcoded
// character count, so switching printers (e.g. to 58mm paper) later is a
// one-line change here, not a hunt through every view that draws a rule.
//
// Current printer: Blueprint ECO80D, 80mm paper (see CLAUDE.md checklist
// "SEBELUM DIPAKAI DI WARUNG"). Character counts below are the standard
// ESC/POS "Font A" (12x24 dot, the default on this class of printer)
// columns-per-line for each paper width — 80mm prints 48 columns, 58mm
// prints 32.
//
// Measured on the real ECO80D with the Tes Lebar Kolom (2026-09-20): Font A
// wraps after exactly 48 columns, i.e. 48 uses the FULL paper width — this is
// the one width constant for every struk/daftar packing rule and price column,
// and it must not be reduced to leave a margin.
export const RECEIPT_PAPER_WIDTH_MM = 80;
export const RECEIPT_CHARS_PER_LINE = RECEIPT_PAPER_WIDTH_MM >= 80 ? 48 : 32;

// Dots one Font A character cell is wide (12x24). Only the on-screen preview
// needs it, to size the logo image in the same character grid the text uses.
export const FONT_A_COLUMN_DOTS = 12;

// How wide a CENTERED HEADING (the warung name) is allowed to get before it
// is broken across lines. 48 is still the hard limit — nothing ever prints
// past it — but a heading that runs the full 48 columns is pressed against
// both paper edges and reads as a wall of text, so two thirds of the width is
// where breaking it starts to look deliberate. Derived, not a magic number:
// change the paper width and this follows.
export const RECEIPT_HEADING_WIDTH = Math.floor((RECEIPT_CHARS_PER_LINE * 2) / 3);

// Greedy word wrap at `width` columns. A single word longer than the width is
// hard-split (a 60-character word has to break somewhere) instead of being
// allowed to run past the paper edge and wrap wherever the printer feels like.
export function wrapWords(value: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    let rest = word;
    while (rest.length > width) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!current) current = rest;
    else if (current.length + 1 + rest.length <= width) current += ` ${rest}`;
    else {
      lines.push(current);
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

// Word wrap for a centered heading, balanced. First decide HOW MANY lines the
// heading needs (a greedy wrap at RECEIPT_HEADING_WIDTH), then use the
// narrowest width that still fits in that many lines — so a centered block
// comes out roughly even instead of one long line plus a stub:
//   "Mie Ayam Pangsit dan Bakso" / "Ciptarasa 4 Wonogiri"   (balanced)
//   "Mie Ayam Pangsit dan Bakso Ciptarasa" / "4 Wonogiri"   (plain greedy)
// Short names (most of them) come back as a single line, untouched.
export function wrapHeading(value: string): string[] {
  const lineCount = wrapWords(value, RECEIPT_HEADING_WIDTH).length;
  if (lineCount <= 1) return wrapWords(value, RECEIPT_CHARS_PER_LINE);
  let narrowest = RECEIPT_CHARS_PER_LINE;
  for (let width = RECEIPT_CHARS_PER_LINE - 1; width >= 1; width--) {
    if (wrapWords(value, width).length > lineCount) break;
    narrowest = width;
  }
  return wrapWords(value, narrowest);
}

// A full-width rule, e.g. "================================================".
export function paperRule(char: "=" | "-"): string {
  return char.repeat(RECEIPT_CHARS_PER_LINE);
}

// A rule with text centered in it and the fill character padding both
// sides, e.g. "=============== TERIMA KASIH ===============" — always
// exactly RECEIPT_CHARS_PER_LINE wide (rounds down if it doesn't divide
// evenly, so it never overflows to a second line on real paper).
export function centeredRule(text: string, char: "=" | "-" = "="): string {
  const inner = ` ${text} `;
  const fillTotal = Math.max(RECEIPT_CHARS_PER_LINE - inner.length, 2);
  const left = Math.floor(fillTotal / 2);
  const right = fillTotal - left;
  return char.repeat(left) + inner + char.repeat(right);
}
