import { RECEIPT_LOGO_SRC, type LayoutLine } from "@/lib/printing/receipt-layout";
import { cn } from "@/components/ui/cn";

// HTML renderer for the line list built by receipt-layout.ts — the on-screen
// twin of the ESC/POS renderer in lib/printing/escpos.ts. It decides only how
// each line LOOKS here (font weight, small text, "□"); what the lines say and
// their order come from the layout module, so preview and paper cannot drift.

// "No. Order   : 67" — label column fixed-width (monospace `ch` unit) so the
// colons line up down the block regardless of label length.
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="inline-block w-[10ch] shrink-0">{label}</span>
      <span>: {value}</span>
    </div>
  );
}

function PaperLine({ line, afterRule }: { line: LayoutLine; afterRule: boolean }) {
  switch (line.kind) {
    case "logo":
      return (
        <div className="flex flex-col items-center gap-0.5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, not a Next/Image-optimized remote image */}
          <img src={RECEIPT_LOGO_SRC} alt="" className="w-[208px]" />
          <div className="text-[11px] leading-tight">{line.caption}</div>
        </div>
      );
    case "text":
      return (
        <div
          className={cn(
            line.align === "center" && "text-center",
            line.role === "title" && "text-sm leading-tight font-bold",
            line.role === "heading" && "mt-1 font-bold",
            line.role === "small" && "text-[11px] leading-tight",
            line.role === "body" && "text-[12px] text-neutral-700",
            line.role === "note" && "text-[12px]",
          )}
        >
          {line.text}
        </div>
      );
    case "blank":
      return <div className="h-2" />;
    case "rule":
      // A literal repeated-character rule, the same string the printer gets,
      // shrunk so RECEIPT_CHARS_PER_LINE characters span exactly the width.
      return <div className="my-1.5 overflow-hidden text-[9px] leading-none whitespace-pre">{line.text}</div>;
    case "meta":
      return <MetaRow label={line.label} value={line.value} />;
    case "pair":
      return (
        <div
          className={cn(
            "flex justify-between gap-2",
            (line.role === "item" || line.role === "qty") && !afterRule && "mt-2",
            line.role === "total" && "text-base font-bold",
          )}
        >
          <span>
            {line.checkbox ? "□ " : ""}
            {line.left}
          </span>
          <span className={cn(line.role === "qty" && "text-lg font-bold")}>{line.right}</span>
        </div>
      );
    case "sub":
      return (
        <div className={cn("pl-3 text-[12px] text-neutral-700", line.role === "note" && "italic")}>{line.text}</div>
      );
  }
}

// Simulates an 80mm thermal paper on screen: narrow fixed width, monospace.
export function PaperView({ lines }: { lines: LayoutLine[] }) {
  return (
    <div className="mx-auto w-[320px] bg-white p-4 font-mono text-[13px] leading-relaxed text-black">
      {lines.map((line, i) => (
        <PaperLine key={i} line={line} afterRule={lines[i - 1]?.kind === "rule"} />
      ))}
    </div>
  );
}
