import { formatId } from "@/lib/timezone";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import type { MieReportPoint } from "./get-mie-report";
import type { MieProductType } from "./types";

type MentahType = Exclude<MieProductType, "FROZEN">;

export type MieGranularity = "harian" | "mingguan" | "bulanan";

export type MieTypeTotals = { kg: number; amount: number };

export type MieBucket = {
  key: string;
  label: string; // short, for the chart axis
  longLabel: string; // for the table / selected-period heading
  omzet: number; // sum of ORDER amounts — EXCLUDING Frozen, see frozenAmount
  payments: number; // sum of PAYMENT amounts
  kg: number; // EXCLUDING Frozen
  byType: Record<MentahType, MieTypeTotals>;
  // Mie Frozen is a warung POS product, not mi mentah (owner's call, 22 Sep
  // 2026) — tracked here SEPARATELY, never folded into omzet/kg/byType
  // above, so it can never inflate the mi-mentah stats those feed.
  frozenKg: number;
  frozenAmount: number;
};

// Default window per granularity — what the screen opens on, and what the
// Harian/Mingguan/Bulanan buttons snap back to. From there the owner can set
// any dari–sampai range they like (see defaultRangeFor / bucketMie below).
// Empty periods inside the range are always drawn (a day with no sales is a
// real zero, not a missing bar).
const DEFAULT_BUCKET_COUNT: Record<MieGranularity, number> = { harian: 14, mingguan: 8, bulanan: 6 };

// A safety rail, not a feature: a mistyped year ("2015" in the Dari field)
// would otherwise try to draw a few thousand daily bars. Past this the oldest
// periods are dropped, keeping the most recent ones.
const MAX_BUCKETS = 400;

// Pure calendar-day math on "YYYY-MM-DD" strings that are already Jakarta
// dates (get-mie-report.ts converts via timezone.ts) — Date.UTC is only a
// day-arithmetic scratchpad here, same trick as timezone.ts's
// mondayOfLocalWeek, so the runtime's own timezone never matters.
function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
// Noon-UTC instant for display, so formatId (Asia/Jakarta) never rolls into
// the neighbouring day.
function displayInstant(d: Date): Date {
  return new Date(d.getTime() + 5 * 60 * 60 * 1000);
}

function bucketStart(day: string, g: MieGranularity): Date {
  const d = parse(day);
  if (g === "mingguan") {
    const dow = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (dow - 1));
  } else if (g === "bulanan") {
    d.setUTCDate(1);
  }
  return d;
}

function step(d: Date, g: MieGranularity, n: number): Date {
  const next = new Date(d);
  if (g === "harian") next.setUTCDate(next.getUTCDate() + n);
  else if (g === "mingguan") next.setUTCDate(next.getUTCDate() + 7 * n);
  else next.setUTCMonth(next.getUTCMonth() + n);
  return next;
}

function labels(start: Date, g: MieGranularity): { label: string; longLabel: string } {
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

function emptyByType(): Record<MentahType, MieTypeTotals> {
  return {
    MIE_KERITING: { kg: 0, amount: 0 },
    MIE_LURUS: { kg: 0, amount: 0 },
    PANGSIT: { kg: 0, amount: 0 },
    CUSTOM: { kg: 0, amount: 0 },
  };
}

// The window each granularity button opens on, ending today.
export function defaultRangeFor(g: MieGranularity, today: string): DateRange {
  const start = step(bucketStart(today, g), g, -(DEFAULT_BUCKET_COUNT[g] - 1));
  return { from: fmt(start), to: today };
}

// True while the owner hasn't picked a range of their own — used to decide
// whether switching Harian/Mingguan/Bulanan may move the range.
export function isDefaultRange(range: DateRange, g: MieGranularity, today: string): boolean {
  const d = defaultRangeFor(g, today);
  return range.from === d.from && range.to === d.to;
}

// Every number on the Ringkasan page comes out of this: points outside the
// range simply never land in a bucket, so omzet, pembayaran, kg, the per-type
// breakdown and the chart all follow the selected range together.
export function bucketMie(points: MieReportPoint[], g: MieGranularity, range: DateRange): MieBucket[] {
  const { from, to } = normalizeRange(range);
  const first = bucketStart(from, g);
  const last = bucketStart(to, g);

  const buckets: MieBucket[] = [];
  const byKey = new Map<string, MieBucket>();
  for (let start = first; fmt(start) <= fmt(last); start = step(start, g, 1)) {
    const key = fmt(start);
    const bucket: MieBucket = {
      key,
      ...labels(start, g),
      omzet: 0,
      payments: 0,
      kg: 0,
      byType: emptyByType(),
      frozenKg: 0,
      frozenAmount: 0,
    };
    buckets.push(bucket);
    byKey.set(key, bucket);
    if (buckets.length > MAX_BUCKETS + 1) break;
  }
  while (buckets.length > MAX_BUCKETS) byKey.delete(buckets.shift()!.key);

  for (const p of points) {
    // A partial first/last period (range starting mid-week/mid-month) must
    // not pull in the days of that period that fall outside the range.
    if (p.day < from || p.day > to) continue;
    const bucket = byKey.get(fmt(bucketStart(p.day, g)));
    if (!bucket) continue; // outside the visible window
    if (p.kind === "PAYMENT") {
      bucket.payments += p.amount;
      continue;
    }
    if (p.productType === "FROZEN") {
      bucket.frozenKg += p.kg;
      bucket.frozenAmount += p.amount;
      continue;
    }
    bucket.omzet += p.amount;
    bucket.kg += p.kg;
    const t = bucket.byType[p.productType ?? "CUSTOM"];
    t.kg += p.kg;
    t.amount += p.amount;
  }
  return buckets;
}
