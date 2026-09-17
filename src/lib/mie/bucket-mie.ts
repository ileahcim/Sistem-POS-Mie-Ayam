import { formatId } from "@/lib/timezone";
import type { MieReportPoint } from "./get-mie-report";
import type { MieProductType } from "./types";

export type MieGranularity = "harian" | "mingguan" | "bulanan";

export type MieTypeTotals = { kg: number; amount: number };

export type MieBucket = {
  key: string;
  label: string; // short, for the chart axis
  longLabel: string; // for the table / selected-period heading
  omzet: number; // sum of ORDER amounts
  payments: number; // sum of PAYMENT amounts
  kg: number;
  byType: Record<MieProductType, MieTypeTotals>;
};

// Most-recent N periods shown, including empty ones (a day with no sales
// is a real zero, not a missing bar).
const BUCKET_COUNT: Record<MieGranularity, number> = { harian: 14, mingguan: 8, bulanan: 6 };

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

function emptyByType(): Record<MieProductType, MieTypeTotals> {
  return {
    MIE_KERITING: { kg: 0, amount: 0 },
    MIE_LURUS: { kg: 0, amount: 0 },
    PANGSIT: { kg: 0, amount: 0 },
    CUSTOM: { kg: 0, amount: 0 },
  };
}

export function bucketMie(points: MieReportPoint[], g: MieGranularity, today: string): MieBucket[] {
  const count = BUCKET_COUNT[g];
  const last = bucketStart(today, g);
  const buckets: MieBucket[] = [];
  const byKey = new Map<string, MieBucket>();
  for (let i = count - 1; i >= 0; i--) {
    const start = step(last, g, -i);
    const key = fmt(start);
    const bucket: MieBucket = { key, ...labels(start, g), omzet: 0, payments: 0, kg: 0, byType: emptyByType() };
    buckets.push(bucket);
    byKey.set(key, bucket);
  }

  for (const p of points) {
    const bucket = byKey.get(fmt(bucketStart(p.day, g)));
    if (!bucket) continue; // outside the visible window
    if (p.kind === "PAYMENT") {
      bucket.payments += p.amount;
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
