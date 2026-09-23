import type { BusyHourBucket } from "@/lib/dashboard/aggregate-sales";
import { Card } from "@/components/ui/card";
import { BarChart } from "./bar-chart";

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}.00`;
}

// "Jam Sibuk" (CLAUDE.md, 24 Sep 2026) — order count per hour of day,
// counted from createdAt (when the order was placed), same shared
// date-range filter as sections 3-6. VOID/CANCELLED excluded upstream
// (get-sales-data.ts's getDashboardOrderTimings).
export function BusyHoursSection({ buckets, rangeLabel }: { buckets: BusyHourBucket[]; rangeLabel: string }) {
  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Jam Sibuk ({rangeLabel})</h2>
      <Card padded>
        <p className="text-ink-muted mb-3 text-sm">Jumlah order per jam, berdasarkan waktu order dibuat.</p>
        <BarChart bars={buckets.map((b) => ({ label: formatHourLabel(b.hour), value: b.count }))} />
      </Card>
    </section>
  );
}
