import { formatId } from "@/lib/timezone";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import type { MieReportPoint } from "./get-mie-report";
import { mieCostKeyOf, mieOrderMargin, type MieCostKey, type MieCosts } from "./types";

export type MieGranularity = "harian" | "mingguan" | "bulanan";

// One row of Ringkasan's "Per jenis mi" table. Mi Pasar is its own row
// (separate from Reguler Mi Keriting) because it has its own modal per kg.
export type MieJenisKey = MieCostKey | "CUSTOM";
export const MIE_JENIS_KEYS: MieJenisKey[] = ["MIE_KERITING", "MIE_PASAR", "MIE_LURUS", "PANGSIT", "CUSTOM"];

// Every total here is NET of retur (26 Sep 2026): a RETURN row takes its kg,
// value and margin back off, since the sale didn't happen after all — and
// no loss is booked, because the returned mi is used at the warung. With the
// same price on both, the margin is (harga − modal) × kg bersih.
export type MieTypeTotals = {
  kg: number;
  amount: number;
  margin: number; // summed over rows that HAVE a modal per kg only
  // Rows left out of `margin` because their jenis has no modal (not filled
  // in yet, or CUSTOM) — never folded in as cost 0, which would overstate
  // the profit. Drives the "belum diisi" warning.
  noCost: { count: number; kg: number; amount: number };
};

export function emptyTypeTotals(): Record<MieJenisKey, MieTypeTotals> {
  const totals = {} as Record<MieJenisKey, MieTypeTotals>;
  for (const key of MIE_JENIS_KEYS) totals[key] = { kg: 0, amount: 0, margin: 0, noCost: { count: 0, kg: 0, amount: 0 } };
  return totals;
}

export function addTypeTotals(into: MieTypeTotals, from: MieTypeTotals): void {
  into.kg += from.kg;
  into.amount += from.amount;
  into.margin += from.margin;
  into.noCost.count += from.noCost.count;
  into.noCost.kg += from.noCost.kg;
  into.noCost.amount += from.noCost.amount;
}

// Which "Per jenis mi" row an ORDER point belongs to. null = a legacy row on
// the retired FROZEN value, which isn't mi mentah at all (see types.ts).
export function mieJenisKeyOf(p: Pick<MieReportPoint, "productType" | "isPasar">): MieJenisKey | null {
  if (p.productType == null || p.productType === "CUSTOM") return "CUSTOM";
  return mieCostKeyOf(p);
}

export type MieBucket = {
  key: string;
  label: string; // short, for the chart axis
  longLabel: string; // for the table / selected-period heading
  omzet: number; // ORDER amounts minus RETURN amounts (omzet bersih)
  payments: number; // sum of PAYMENT amounts
  kg: number; // net of retur, like omzet
  returns: number; // sum of RETURN amounts (the Retur card)
  returnKg: number;
  margin: number; // sum of byType[*].margin
  byType: Record<MieJenisKey, MieTypeTotals>;
  // The exact rows each total above was summed from, kept so the drill-down
  // list under the stat cards can never show a different set than the number
  // it opened from — a row is pushed here in the same branch that adds it to
  // the total, never re-filtered separately.
  orderRows: MieReportPoint[]; // ORDER and RETURN rows — what omzet/kg/margin were summed from
  paymentRows: MieReportPoint[];
  returnRows: MieReportPoint[];
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
export function bucketMie(
  points: MieReportPoint[],
  g: MieGranularity,
  range: DateRange,
  costs: MieCosts,
): MieBucket[] {
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
      returns: 0,
      returnKg: 0,
      margin: 0,
      byType: emptyTypeTotals(),
      orderRows: [],
      paymentRows: [],
      returnRows: [],
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
      bucket.paymentRows.push(p);
      continue;
    }
    // A live row can still carry the DB's retired "FROZEN" value (existing
    // production data pending the owner's approval to move it into the
    // Frozen buku — see types.ts's doc comment) — skip it here entirely
    // rather than crash on an unknown byType key; it's not mi mentah.
    const key = mieJenisKeyOf(p);
    if (!key) continue;
    const t = bucket.byType[key];
    const isReturn = p.kind === "RETURN";
    const sign = isReturn ? -1 : 1;
    const kg = p.kg ?? 0;
    bucket.omzet += sign * p.amount;
    bucket.kg += sign * kg;
    t.kg += sign * kg;
    t.amount += sign * p.amount;
    const margin = mieOrderMargin(p, costs);
    if (margin == null) {
      // A retur of a jenis without modal is left out of the margin exactly
      // like its pesanan; `count` stays a count of pesanan (the warning text).
      if (!isReturn) t.noCost.count += 1;
      t.noCost.kg += sign * kg;
      t.noCost.amount += sign * p.amount;
    } else {
      t.margin += sign * margin;
      bucket.margin += sign * margin;
    }
    bucket.orderRows.push(p);
    if (isReturn) {
      bucket.returns += p.amount;
      bucket.returnKg += kg;
      bucket.returnRows.push(p);
    }
  }
  return buckets;
}
