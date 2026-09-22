import { RECEIPT_LOGO_SRC, RECEIPT_LOGO_WIDTH_DOTS, type LayoutLine } from "@/lib/printing/receipt-layout";
import { FONT_A_COLUMN_DOTS, RECEIPT_CHARS_PER_LINE } from "@/lib/printing/paper";
import { cn } from "@/components/ui/cn";

// HTML renderer for the line list built by receipt-layout.ts — the on-screen
// twin of the ESC/POS renderer in lib/printing/escpos.ts. It decides only how
// each line LOOKS here (font weight, "□"); what the lines say and their order
// come from the layout module, so preview and paper cannot drift.
//
// This is a CHARACTER GRID, not a styled document: the paper is exactly
// RECEIPT_CHARS_PER_LINE `ch` wide, every line is one row of the same
// monospace size, and nothing has its own font size or vertical margin. The
// whole point of MockPrinter is checking a layout without burning paper, and
// that fails the moment the preview wraps somewhere the printer wouldn't —
// which is exactly what a 320px box did: it fit ~37 columns, so a 47-column
// warung name broke in two on screen and stayed on one line on paper.
//
// Emphasis is BOLD ONLY, never a bigger glyph — measured on the real ECO80D
// (Tes Ketajaman, 20 Sep 2026): double-height and double-width text smears,
// plain and bold text are crisp (CLAUDE.md "Struk & printer").

// "No. Order   : 67" — label column fixed-width (monospace `ch` unit) so the
// colons line up down the block, the same 10 columns escpos.ts pads to.
function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex", bold && "font-bold")}>
      <span className="inline-block w-[10ch] shrink-0">{label}</span>
      <span>: {value}</span>
    </div>
  );
}

function PaperLine({ line }: { line: LayoutLine }) {
  switch (line.kind) {
    case "logo":
      // Same fraction of the paper the raster really takes: the logo is
      // RECEIPT_LOGO_WIDTH_DOTS wide and one column is FONT_A_COLUMN_DOTS.
      return (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, not a Next/Image-optimized remote image */}
          <img src={RECEIPT_LOGO_SRC} alt="" style={{ width: `${RECEIPT_LOGO_WIDTH_DOTS / FONT_A_COLUMN_DOTS}ch` }} />
        </div>
      );
    case "text":
      return (
        <div
          className={cn(
            line.align === "center" && "text-center",
            (line.role === "title" || line.role === "heading") && "font-bold",
          )}
        >
          {line.text}
        </div>
      );
    case "blank":
      // A blank line is one row of paper, no more and no less.
      return <div className="whitespace-pre"> </div>;
    case "rule":
      // The literal repeated-character rule, the same string the printer
      // gets — at this width it spans the paper on its own, no shrinking.
      return <div className="whitespace-pre">{line.text}</div>;
    case "meta":
      return <MetaRow label={line.label} value={line.value} bold={line.bold} />;
    case "pair":
      // justify-between lands the value on the right edge, where escpos.ts
      // pads it to with spaces. Total is bold end to end; a daftar packing
      // row bolds only the qty — the same two shapes escpos.ts emits.
      return (
        <div className={cn("flex justify-between gap-[1ch]", line.role === "total" && "font-bold")}>
          <span className="whitespace-pre">
            {line.checkbox ? "□ " : ""}
            {line.left}
          </span>
          <span className={cn(line.role === "qty" && "font-bold")}>{line.right}</span>
        </div>
      );
    case "sub":
      // One leading space on paper, so one column of indent here.
      return <div className={cn("pl-[1ch]", line.bold && "font-bold")}>{line.text}</div>;
  }
}

// Simulates 80mm thermal paper on screen: exactly as many monospace columns
// as the printer has. The font size is what makes that fit on a phone; the
// column count never changes with the screen (a narrow screen scrolls the
// overlay instead of re-wrapping the receipt).
export function PaperView({ lines }: { lines: LayoutLine[] }) {
  return (
    <div className="mx-auto w-fit bg-white p-3 font-mono text-[11px] leading-[1.45] text-black">
      <div style={{ width: `${RECEIPT_CHARS_PER_LINE}ch` }}>
        {lines.map((line, i) => (
          <PaperLine key={i} line={line} />
        ))}
      </div>
    </div>
  );
}
