import { Fragment, type ReactNode } from "react";
import { layoutOrderLines, type GroupableLine } from "@/lib/orders/line-order";
import { cn } from "./cn";

// The list of order lines every screen shows (cart, order detail, payment):
// lines in the order given — callers pass them through sortOrderLines — plus,
// on a big order, the per-product "Mie Ayam: 4 porsi" counts and the dashed
// dividers between blocks (rules in layoutOrderLines). Each screen keeps its
// own row component; this only decides what sits between the rows.
export function OrderLineList<T extends GroupableLine>({
  lines,
  keyOf,
  renderLine,
  // Horizontal padding of the count/divider rows, to line up with the rows.
  inset = "px-0",
  // A solid hairline between two adjacent rows (what `divide-y` used to do —
  // it can't be used here, it would also rule off the count and dashed rows).
  divided = false,
}: {
  lines: readonly T[];
  keyOf: (line: T) => string;
  renderLine: (line: T) => ReactNode;
  inset?: string;
  divided?: boolean;
}) {
  const { entries } = layoutOrderLines(lines);
  return (
    <>
      {entries.map((entry, i) =>
        entry.kind === "line" ? (
          <Fragment key={keyOf(entry.line)}>
            {divided && entries[i - 1]?.kind === "line" && <div className="border-border border-t" aria-hidden />}
            {renderLine(entry.line)}
          </Fragment>
        ) : entry.kind === "groupTotal" ? (
          <p key={entry.key} className={cn("text-ink-muted py-1.5 text-sm font-semibold", inset)}>
            {entry.productName}: {entry.portions} porsi
          </p>
        ) : (
          <div key={entry.key} className={cn("py-1", inset)} aria-hidden>
            <div className="border-ink-faint border-t border-dashed" />
          </div>
        ),
      )}
    </>
  );
}

// "Total: 9 item" above Subtotal — shown on the same big orders that get the
// grouping, so the two always appear together.
export function PortionTotalRow({ lines, className }: { lines: readonly GroupableLine[]; className?: string }) {
  const { grouped, portions } = layoutOrderLines(lines);
  if (!grouped) return null;
  return (
    <div className={cn("text-ink flex justify-between text-sm font-semibold", className)}>
      <span>Total: {portions} item</span>
    </div>
  );
}
