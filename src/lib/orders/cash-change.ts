// "Hitung kembalian" (26 Sep 2026): for a full-Cash payment the cashier may
// enter what the customer handed over and the change is computed. One rule
// for the screens AND the server (same pattern as validateSplitCashAmount).
//
// These are NOTES. The drawer always counts what was charged — the order
// total, the sisa after DP, or the DP amount — never the money handed over,
// which leaves the drawer again as change a moment later. Nothing in
// shift-math.ts / closeShift reads cashTendered or changeGiven.

import { formatRupiah } from "@/lib/printing/format";

// Quick buttons beside "Uang pas" (which is always exactly the amount due).
export const CASH_TENDERED_PRESETS = [20000, 50000, 100000] as const;

// null = fine. `due` is what this payment actually charges.
export function validateCashTendered(tendered: number, due: number): string | null {
  if (!Number.isInteger(tendered) || tendered <= 0) return "Isi uang yang diterima.";
  if (tendered < due) return "Uang diterima kurang dari yang harus dibayar.";
  return null;
}

// What goes back to the customer. Only meaningful once validateCashTendered passed.
export function changeFor(tendered: number, due: number): number {
  return tendered - due;
}

// The one wording for screens that show the note again (detail order,
// Riwayat Pesanan, DP rows). null when nothing was entered.
export function formatTenderedNote(cashTendered: number | null, changeGiven: number | null): string | null {
  if (cashTendered == null) return null;
  return `Uang diterima ${formatRupiah(cashTendered)} · Kembalian ${formatRupiah(changeGiven ?? 0)}`;
}
