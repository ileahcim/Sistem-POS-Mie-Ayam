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
export function OmzetSection({ history }: { history: OmzetShiftPoint[] }) {
  const [granularity, setGranularity] = useState<OmzetGranularity>("harian");
  const buckets = useMemo(() => bucketOmzet(history, granularity), [history, granularity]);
  const total = buckets.reduce((sum, b) => sum + b.total, 0);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-ink text-base font-bold">Omzet</h2>
        <div className="flex gap-1.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGranularity(opt.value)}
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
        <p className="text-ink-muted text-sm">
          Total {OPTIONS.find((o) => o.value === granularity)?.label.toLowerCase()}
        </p>
        <p className="text-ink mb-3 text-xl font-bold">{formatRupiah(total)}</p>
        <BarChart bars={buckets.map((b) => ({ label: b.label, value: b.total }))} />
      </Card>
    </section>
  );
}
