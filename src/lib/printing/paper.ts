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
export const RECEIPT_PAPER_WIDTH_MM = 80;
export const RECEIPT_CHARS_PER_LINE = RECEIPT_PAPER_WIDTH_MM >= 80 ? 48 : 32;

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
