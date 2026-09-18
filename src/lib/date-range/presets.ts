// Shared "dari–sampai" range + quick presets for the two report screens that
// have one (Riwayat Pesanan and Ringkasan Mi Mentah). Identical buttons in
// both places so the owner learns them once.
//
// Everything here is pure calendar math on "YYYY-MM-DD" strings, and `today`
// is ALWAYS passed in from the server (localDateStr, Asia/Jakarta — see
// CLAUDE.md "Zona waktu"), never read from the browser clock: a tablet set to
// the wrong timezone must not be able to shift what "Hari ini" means. Date.UTC
// below is only a day-arithmetic scratchpad, so the runtime's own timezone
// never enters into it.

export type DateRange = { from: string; to: string };

function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function addDays(day: string, n: number): string {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function addMonths(day: string, n: number): string {
  const d = parse(day);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmt(d);
}

export function monthStart(day: string): string {
  const d = parse(day);
  d.setUTCDate(1);
  return fmt(d);
}

export function monthEnd(day: string): string {
  const d = parse(day);
  d.setUTCMonth(d.getUTCMonth() + 1, 0); // day 0 of next month = last of this one
  return fmt(d);
}

// from/to the wrong way round is a slip, not an error worth an alert —
// reading them in the order that makes sense is what the owner meant.
export function normalizeRange(range: DateRange): DateRange {
  return range.from <= range.to ? range : { from: range.to, to: range.from };
}

export type DateRangePreset = {
  key: string;
  label: string;
  range: (today: string) => DateRange;
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { key: "hari-ini", label: "Hari ini", range: (t) => ({ from: t, to: t }) },
  { key: "7-hari", label: "7 hari", range: (t) => ({ from: addDays(t, -6), to: t }) },
  { key: "30-hari", label: "30 hari", range: (t) => ({ from: addDays(t, -29), to: t }) },
  { key: "bulan-ini", label: "Bulan ini", range: (t) => ({ from: monthStart(t), to: t }) },
  {
    key: "bulan-lalu",
    label: "Bulan lalu",
    range: (t) => {
      const inLastMonth = addMonths(monthStart(t), -1);
      return { from: inLastMonth, to: monthEnd(inLastMonth) };
    },
  },
];

// Which preset (if any) the current range happens to match — so the chip the
// owner just tapped stays visibly selected, and a hand-typed range that lands
// on the same days lights it up too.
export function activePresetKey(range: DateRange, today: string): string | null {
  for (const preset of DATE_RANGE_PRESETS) {
    const r = preset.range(today);
    if (r.from === range.from && r.to === range.to) return preset.key;
  }
  return null;
}
