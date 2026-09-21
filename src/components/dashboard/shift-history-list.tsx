"use client";

import { useState } from "react";
import type { ShiftHistoryRow } from "@/lib/dashboard/get-shift-history";
import { formatRupiah } from "@/lib/printing/format";
import { formatId } from "@/lib/timezone";
import { cn } from "@/components/ui/cn";
import { ShiftSummary, differenceClass, formatDifference } from "@/components/shift/shift-summary";

// One short row per closed shift — Tanggal, Kasir, Total Penjualan, Selisih —
// and a tap opens the full breakdown right under it, in exactly the two-part
// layout of the Tutup Shift result (ShiftSummary). The old table had every
// column side by side; with the DP columns it no longer fit a tablet and the
// right-most columns (Selisih among them) were cut off. Instant, no animation
// (CLAUDE.md "Animasi"). The Excel export still carries every column.
export function ShiftHistoryList({ shifts }: { shifts: ShiftHistoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="divide-border flex flex-col divide-y">
      <div className="text-ink-muted grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 text-xs font-medium sm:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <span>
          Tanggal<span className="sm:hidden"> · Kasir</span>
        </span>
        <span className="hidden sm:block">Kasir</span>
        <span className="text-right">Total Penjualan</span>
        <span className="text-right">Selisih</span>
      </div>
      {shifts.map((s) => {
        const open = openId === s.id;
        return (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : s.id)}
              aria-expanded={open}
              className={cn(
                "grid min-h-12 w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2 text-left text-sm sm:grid-cols-[1.2fr_1fr_1fr_1fr]",
                open && "bg-primary-soft",
              )}
            >
              <span className="text-ink min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-ink-faint w-3 text-xs" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                  {formatId(new Date(s.closedAt), { dateStyle: "medium" })}
                </span>
                <span className="text-ink-muted block truncate pl-[18px] text-xs sm:hidden">{s.openedByName}</span>
              </span>
              <span className="text-ink hidden truncate sm:block">{s.openedByName}</span>
              <span className="text-ink text-right tabular-nums">{formatRupiah(s.cashSales + s.nonCashSales)}</span>
              <span className={cn("text-right font-bold tabular-nums", differenceClass(s.difference))}>
                {formatDifference(s.difference)}
              </span>
            </button>
            {open && (
              <div className="bg-canvas px-3 py-3">
                <div className="bg-surface rounded-card border-border mx-auto max-w-xl border p-4">
                  <ShiftSummary figures={s} salesTitle="Penjualan Shift Ini" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
