"use client";

import { useMemo, useState } from "react";
import type { OmzetShiftPoint } from "@/lib/dashboard/get-omzet-history";
import { bucketOmzet, type OmzetGranularity } from "@/lib/dashboard/bucket-omzet";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { formatRupiah } from "@/lib/printing/format";
import { BarChart } from "./bar-chart";

const OPTIONS: { value: OmzetGranularity; label: string }[] = [
  { value: "harian", label: "Harian" },
  { value: "mingguan", label: "Mingguan" },
  { value: "bulanan", label: "Bulanan" },
];

// Section 2. Buckets client-side from a wide raw history (see
// get-omzet-history.ts) so switching range is instant, no round trip —
// same frozen Shift.cashSales/nonCashSales numbers as section 1 (plus
// "DP hangus", kept from cancelled pre-orders), summed per bucket, never
// recomputed from Order.
//
// Tap a bar to focus the headline number on that one day / week / month (the
// bar is highlighted); tap it again, or "Semua", to go back to the total of
// every bar. Switching Harian/Mingguan/Bulanan clears the choice.
export function OmzetSection({ history }: { history: OmzetShiftPoint[] }) {
  const [granularity, setGranularity] = useState<OmzetGranularity>("harian");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const buckets = useMemo(() => bucketOmzet(history, granularity), [history, granularity]);
  const selectedIndex = buckets.findIndex((b) => b.key === selectedKey);
  const selected = selectedIndex >= 0 ? buckets[selectedIndex] : null;
  const total = selected ? selected.total : buckets.reduce((sum, b) => sum + b.total, 0);
  const heading = selected
    ? `Omzet ${granularity === "mingguan" ? `minggu mulai ${selected.label}` : selected.label}`
    : `Total ${OPTIONS.find((o) => o.value === granularity)?.label.toLowerCase()}`;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-ink text-base font-bold">Omzet</h2>
        <div className="flex gap-1.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setGranularity(opt.value);
                setSelectedKey(null);
              }}
              className={cn(
                "rounded-pill h-9 px-3 text-sm font-semibold",
                granularity === opt.value ? "bg-ink text-white" : "bg-muted text-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <Card padded>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-ink-muted text-sm" data-testid="omzet-heading">
              {heading}
            </p>
            <p className="text-ink text-xl font-bold" data-testid="omzet-total">
              {formatRupiah(total)}
            </p>
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="rounded-pill bg-muted text-ink h-12 shrink-0 px-4 text-sm font-semibold"
            >
              Semua
            </button>
          )}
        </div>
        <BarChart
          bars={buckets.map((b) => ({ label: b.label, value: b.total }))}
          selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
          onSelect={(i) => setSelectedKey((cur) => (cur === buckets[i].key ? null : buckets[i].key))}
          describe={(b) => `${b.label}: ${formatRupiah(b.value)}`}
        />
      </Card>
    </section>
  );
}
