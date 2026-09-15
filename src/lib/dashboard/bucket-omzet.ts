import type { OmzetShiftPoint } from "./get-omzet-history";

export type OmzetGranularity = "harian" | "mingguan" | "bulanan";

export type OmzetBucket = {
  key: string;
  label: string;
  total: number;
};

// How many most-recent buckets to show per granularity — enough to see a
// real trend without the chart turning into an unreadable smear on a
// 390px-wide phone screen.
const BUCKET_COUNT: Record<OmzetGranularity, number> = {
  harian: 30,
  mingguan: 12,
  bulanan: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Monday of the ISO week containing `d`, at local midnight.
function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay() || 7; // Sunday -> 7
  if (day > 1) copy.setDate(copy.getDate() - (day - 1));
  return copy;
}

function bucketKey(date: Date, granularity: OmzetGranularity): { key: string; label: string } {
  if (granularity === "harian") {
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    const label = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
    return { key, label };
  }
  if (granularity === "mingguan") {
    const monday = mondayOf(date);
    const key = `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
    const label = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(monday);
    return { key, label };
  }
  const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  const label = new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(date);
  return { key, label };
}

// Pure so it's usable both in the client chart and (if ever needed) in a
// test — buckets by the shift's openedAt "business day", sums cashSales +
// nonCashSales (the same frozen numbers get-shift-history.ts uses), and
// returns only the most recent N buckets in chronological order.
export function bucketOmzet(points: OmzetShiftPoint[], granularity: OmzetGranularity): OmzetBucket[] {
  const byKey = new Map<string, OmzetBucket>();

  for (const point of points) {
    const date = new Date(point.openedAt);
    const { key, label } = bucketKey(date, granularity);
    const existing = byKey.get(key);
    const amount = point.cashSales + point.nonCashSales;
    if (existing) {
      existing.total += amount;
    } else {
      byKey.set(key, { key, label, total: amount });
    }
  }

  const sorted = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  return sorted.slice(-BUCKET_COUNT[granularity]);
}
