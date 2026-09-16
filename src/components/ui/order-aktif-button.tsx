import Link from "next/link";
import { cn } from "./cn";

// Tiered on purpose (see CLAUDE.md-worthy brief this was built from): a
// plain count badge during normal business (busy is normal, not alarming),
// escalating to a red button + pulsing badge only once an order has
// actually crossed the 2x-estimate late threshold — so the loud state stays
// rare and meaningful instead of being permanently on during every rush and
// getting tuned out. Server-renderable (no "use client" — animate-pulse is
// plain CSS), same pattern as LinkButton.
export function OrderAktifButton({ activeCount, lateCount }: { activeCount: number; lateCount: number }) {
  const isLate = lateCount > 0;

  return (
    <Link
      href="/order-aktif"
      className={cn(
        "rounded-pill relative flex h-12 shrink-0 items-center px-4 text-sm font-semibold",
        isLate ? "bg-danger text-white" : "bg-muted text-ink",
      )}
    >
      Order Aktif
      {activeCount > 0 && (
        <span
          className={cn(
            "absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold",
            isLate ? "bg-surface text-danger animate-pulse" : "bg-primary text-white",
          )}
        >
          {activeCount}
        </span>
      )}
    </Link>
  );
}
