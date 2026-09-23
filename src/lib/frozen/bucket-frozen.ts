import { formatId } from "@/lib/timezone";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import type { FrozenReportPoint } from "./get-frozen-report";

export type FrozenGranularity = "harian" | "mingguan" | "bulanan";

export type FrozenBucket = {
  key: string;
  label: string; // short, for the chart axis
  longLabel: string; // for the table / selected-period heading
  omzet: number; // sum of ORDER amounts
  payments: number; // sum of PAYMENT amounts
  pcs: number;
};

// Default window per granularity — mirrors bucket-mie.ts's DEFAULT_BUCKET_COUNT.
const DEFAULT_BUCKET_COUNT: Record<FrozenGranularity, number> = { harian: 14, mingguan: 8, bulanan: 6 };
const MAX_BUCKETS = 400;

// Pure calendar-day math on "YYYY-MM-DD" strings already in Jakarta dates
// (get-frozen-report.ts converts via timezone.ts) — same trick as bucket-mie.ts.
function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function displayInstant(d: Date): Date {
  return new Date(d.getTime() + 5 * 60 * 60 * 1000);
}

function bucketStart(day: string, g: FrozenGranularity): Date {
  const d = parse(day);
  if (g === "mingguan") {
    const dow = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (dow - 1));
  } else if (g === "bulanan") {
    d.setUTCDate(1);
  }
  return d;
}

function step(d: Date, g: FrozenGranularity, n: number): Date {
  const next = new Date(d);
  if (g === "harian") next.setUTCDate(next.getUTCDate() + n);
  else if (g === "mingguan") next.setUTCDate(next.getUTCDate() + 7 * n);
  else next.setUTCMonth(next.getUTCMonth() + n);
  return next;
}

function labels(start: Date, g: FrozenGranularity): { label: string; longLabel: string } {
  const at = displayInstant(start);
  if (g === "harian") {
    return {
      label: formatId(at, { day: "2-digit", month: "short" }),
      longLabel: formatId(at, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    };
  }
  if (g === "mingguan") {
    const end = displayInstant(step(start, "harian", 6));
    return {
      label: formatId(at, { day: "2-digit", month: "short" }),
      longLabel: `${formatId(at, { day: "numeric", month: "short" })} – ${formatId(end, { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }
  return {
    label: formatId(at, { month: "short", year: "2-digit" }),
    longLabel: formatId(at, { month: "long", year: "numeric" }),
  };
}

export function defaultRangeFor(g: FrozenGranularity, today: string): DateRange {
  const start = step(bucketStart(today, g), g, -(DEFAULT_BUCKET_COUNT[g] - 1));
  return { from: fmt(start), to: today };
}

export function isDefaultRange(range: DateRange, g: FrozenGranularity, today: string): boolean {
  const d = defaultRangeFor(g, today);
  return range.from === d.from && range.to === d.to;
}

// Every number on Ringkasan Frozen comes out of this: points outside the
// range simply never land in a bucket. No per-jenis breakdown — Frozen has
// no jenis concept at all.
export function bucketFrozen(points: FrozenReportPoint[], g: FrozenGranularity, range: DateRange): FrozenBucket[] {
  const { from, to } = normalizeRange(range);
  const first = bucketStart(from, g);
  const last = bucketStart(to, g);

  const buckets: FrozenBucket[] = [];
  const byKey = new Map<string, FrozenBucket>();
  for (let start = first; fmt(start) <= fmt(last); start = step(start, g, 1)) {
    const key = fmt(start);
    const bucket: FrozenBucket = { key, ...labels(start, g), omzet: 0, payments: 0, pcs: 0 };
    buckets.push(bucket);
    byKey.set(key, bucket);
    if (buckets.length > MAX_BUCKETS + 1) break;
  }
  while (buckets.length > MAX_BUCKETS) byKey.delete(buckets.shift()!.key);

  for (const p of points) {
    if (p.day < from || p.day > to) continue;
    const bucket = byKey.get(fmt(bucketStart(p.day, g)));
    if (!bucket) continue;
    if (p.kind === "PAYMENT") {
      bucket.payments += p.amount;
      continue;
    }
    bucket.omzet += p.amount;
    bucket.pcs += p.pcs;
  }
  return buckets;
}
