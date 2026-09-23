"use client";

import { useMemo, useState } from "react";
import type { DashboardOrder } from "@/lib/dashboard/get-sales-data";
import {
  filterOrdersByRange,
  computeTopProducts,
  computeTopToppings,
  computeMarginReport,
  computeLowMarginItems,
  computeChannelBreakdown,
  computeCustomItemGroups,
} from "@/lib/dashboard/aggregate-sales";
import { DATE_RANGE_PRESETS, normalizeRange, type DateRange } from "@/lib/date-range/presets";
import { DateRangePresets } from "@/components/ui/date-range-presets";
import { Card } from "@/components/ui/card";
import { formatId } from "@/lib/timezone";
import { TopItemsSection } from "./top-items-section";
import { MarginSection } from "./margin-section";
import { CustomItemSection } from "./custom-item-section";
import { ChannelBreakdownSection } from "./channel-breakdown-section";

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return formatId(new Date(Date.UTC(y, m - 1, d, 5)), { day: "numeric", month: "short", year: "numeric" });
}

const DEFAULT_PRESET_KEY = "30-hari";

// Sections 3 (Menu & Topping Terlaris), 4 (Margin + Item Custom, 23 Sep
// 2026) and 5 (Per Channel) all read the SAME order-level dataset
// (get-sales-data.ts) and the SAME date range, chosen ONCE here — one
// control instead of a picker per section, so the owner never has to
// wonder why two numbers on the same screen cover different periods.
// Client-side filtering (aggregate-sales.ts, pure functions) means picking
// a preset or typing a date is instant, no round trip — same pattern as
// Ringkasan Mi Mentah and the Omzet chart above.
//
// Used to be a fixed rolling 30-day window with no control at all
// (DASHBOARD_WINDOW_DAYS) — this replaces that for these three sections.
// Section 1 (Riwayat Shift) and 2 (Omzet) are deliberately NOT part of
// this: they read frozen Shift numbers (a closed shift's report must never
// change later) and Omzet already has its own independent
// Harian/Mingguan/Bulanan control (CLAUDE.md "Aturan angka"). Piutang
// (section 6) isn't time-scoped either — a debt doesn't stop being owed
// based on which period is selected.
export function SalesReportSection({ orders, today }: { orders: DashboardOrder[]; today: string }) {
  const [range, setRange] = useState<DateRange>(
    () => DATE_RANGE_PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!.range(today),
  );
  const safeRange = normalizeRange(range);
  const rangeLabel =
    safeRange.from === safeRange.to
      ? formatDay(safeRange.from)
      : `${formatDay(safeRange.from)} – ${formatDay(safeRange.to)}`;

  const filtered = useMemo(() => filterOrdersByRange(orders, safeRange), [orders, safeRange]);
  const topProducts = useMemo(() => computeTopProducts(filtered), [filtered]);
  const topToppings = useMemo(() => computeTopToppings(filtered), [filtered]);
  const marginReport = useMemo(() => computeMarginReport(filtered), [filtered]);
  const lowMarginItems = useMemo(() => computeLowMarginItems(filtered), [filtered]);
  const channelBreakdown = useMemo(() => computeChannelBreakdown(filtered), [filtered]);
  const customItemGroups = useMemo(() => computeCustomItemGroups(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <Card padded className="flex flex-col gap-3">
        <h2 className="text-ink text-base font-bold">Rentang laporan penjualan</h2>
        <p className="text-ink-muted -mt-2 text-sm">
          Berlaku untuk Menu & Topping Terlaris, Margin, Item Custom, dan Per Channel di bawah.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted font-medium">Dari</span>
            <input
              type="date"
              value={range.from}
              max={today}
              onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })}
              className="rounded-input border-border h-12 border px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted font-medium">Sampai</span>
            <input
              type="date"
              value={range.to}
              max={today}
              onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })}
              className="rounded-input border-border h-12 border px-3 text-base"
            />
          </label>
        </div>
        <DateRangePresets today={today} value={safeRange} onPick={setRange} />
      </Card>

      <TopItemsSection products={topProducts} toppings={topToppings} rangeLabel={rangeLabel} />
      <MarginSection report={marginReport} lowMarginItems={lowMarginItems} rangeLabel={rangeLabel} />
      <CustomItemSection groups={customItemGroups} rangeLabel={rangeLabel} />
      <ChannelBreakdownSection rows={channelBreakdown} rangeLabel={rangeLabel} />
    </div>
  );
}
