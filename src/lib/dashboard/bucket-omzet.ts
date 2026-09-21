import type { OmzetShiftPoint } from "./get-omzet-history";
import { localDateParts, mondayOfLocalWeek, formatId } from "@/lib/timezone";

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

function bucketKey(date: Date, granularity: OmzetGranularity): { key: string; label: string } {
  if (granularity === "harian") {
    const p = localDateParts(date);
    const key = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
    const label = formatId(date, { day: "2-digit", month: "short" });
    return { key, label };
  }
  if (granularity === "mingguan") {
    const monday = mondayOfLocalWeek(date);
    const key = `${monday.year}-${pad2(monday.month)}-${pad2(monday.day)}`;
    // Label the Monday's own calendar date — build a scratch instant at
    // Jakarta local noon that day so formatId (timeZone-aware) can never
    // round it into the adjacent day.
    const mondayNoonUtc = new Date(Date.UTC(monday.year, monday.month - 1, monday.day, 5, 0, 0));
    const label = formatId(mondayNoonUtc, { day: "2-digit", month: "short" });
    return { key, label };
  }
  const p = localDateParts(date);
  const key = `${p.year}-${pad2(p.month)}`;
  const label = formatId(date, { month: "short", year: "2-digit" });
  return { key, label };
}

// Pure so it's usable both in the client chart and (if ever needed) in a
// test — buckets by the shift's openedAt "business day" in Jakarta local
// time (see src/lib/timezone.ts — never the runtime's default timezone,
// which is UTC on Vercel), sums cashSales + nonCashSales + forfeitedDeposits
// ("DP hangus" — the same frozen numbers get-shift-history.ts uses), and returns only the most recent N
// buckets in chronological order.
export function bucketOmzet(points: OmzetShiftPoint[], granularity: OmzetGranularity): OmzetBucket[] {
  const byKey = new Map<string, OmzetBucket>();

  for (const point of points) {
    const date = new Date(point.openedAt);
    const { key, label } = bucketKey(date, granularity);
    const existing = byKey.get(key);
    const amount = point.cashSales + point.nonCashSales + point.forfeitedDeposits;
    if (existing) {
      existing.total += amount;
    } else {
      byKey.set(key, { key, label, total: amount });
    }
  }

  const sorted = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  return sorted.slice(-BUCKET_COUNT[granularity]);
}
