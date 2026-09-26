import { formatId, localDateStr, wibDateRange } from "@/lib/timezone";

// "Retur" check (26 Sep 2026, both Note books): a retur bigger than what the
// customer ordered/took of that item over the retur's date and the days just
// before it gets a warning on the form — most likely a typo (50 for 5). A
// warning only, never a block: the owner may be recording something older.
export const NOTE_RETURN_WINDOW_DAYS = 3;

// Tap-first amounts on the retur form (kg or pcs) — small, since a retur is
// the unsold rest of a titip, not a new order.
export const NOTE_RETURN_QTY_PRESETS = [1, 2, 5, 10];

// The business-date window [start, end) of a retur dated `date` (an ISO
// instant at the device's local midnight, as every Note form sends): its
// WIB day and the NOTE_RETURN_WINDOW_DAYS − 1 days before it. Day math on
// "YYYY-MM-DD" strings, Date.UTC only as scratch paper (same as timezone.ts).
export function noteReturnWindow(date: Date): { start: Date; end: Date; fromDay: string; toDay: string } {
  const toDay = localDateStr(date);
  const [y, m, d] = toDay.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - (NOTE_RETURN_WINDOW_DAYS - 1)));
  const fromDay = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}-${String(from.getUTCDate()).padStart(2, "0")}`;
  return { start: wibDateRange(fromDay).start, end: wibDateRange(toDay).end, fromDay, toDay };
}

// What the retur form/sheet needs from the server: the price to suggest and
// how much was ordered in the window (for the warning).
export type NoteReturnContext = {
  // Last ORDER price of this customer for this exact item (Mi Mentah: same
  // jenis, Mi Pasar kept apart from Reguler); null if they never ordered it.
  lastPrice: number | null;
  lastPriceDay: string | null; // "YYYY-MM-DD" business date of that order
  windowQty: number; // kg / pcs ordered in the window
  fromDay: string;
  toDay: string;
};

// "24–26 Sep" for the warning text.
export function formatNoteReturnWindow(fromDay: string, toDay: string): string {
  const at = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 5)); // noon-ish WIB, never rolls over
  };
  const from = at(fromDay);
  const to = at(toDay);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  return `${formatId(from, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })}–${formatId(to, { day: "numeric", month: "short" })}`;
}
