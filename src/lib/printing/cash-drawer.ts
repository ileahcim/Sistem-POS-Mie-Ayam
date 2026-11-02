"use client";

// Cash drawer (laci uang) — plugged into the drawer port on the back of the
// Blueprint ECO80D, opened with the ESC/POS kick (escpos.ts DRAWER_KICK) sent
// through whichever print driver is active. Owner's rules (2 Nov 2026):
//   - it opens by itself whenever cash goes into or out of the drawer at a
//     confirmation: Pembayaran Cash / Cash + QRIS (incl. sisa pre-order and a
//     piutang settled INTO the drawer), DP tunai, pengembalian DP tunai —
//     even when the struk isn't printed. QRIS alone never opens it;
//   - "Buka Laci" on the Kasir screen (every role) and "Tes Buka Laci" in
//     Pengaturan open it by hand;
//   - a failure NEVER undoes or blocks the transaction (it is already saved
//     when this runs) but must be visible: a small notice, see
//     DrawerNoticeHost, mounted once in the root layout so it survives the
//     page change right after a payment.

import type { PrinterDriver, PrintResult } from "./types";
import { getPrinter } from "./get-printer";

export type DrawerNotice = { ok: true; simulated: boolean } | { ok: false; error: string };

type Listener = (notice: DrawerNotice) => void;
const listeners = new Set<Listener>();

export function subscribeDrawerNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Reports the outcome of a kick — standalone, or one that rode along with a
// struk (ReceiptData.kickDrawer), whose print result is the kick's result.
export function reportDrawerResult(driver: PrinterDriver, result: PrintResult): void {
  const notice: DrawerNotice = result.ok ? { ok: true, simulated: driver === "mock" } : { ok: false, error: result.error };
  for (const listener of listeners) listener(notice);
}

// Never throws, never rejects: the caller's transaction is already saved.
export async function openCashDrawer(driver: PrinterDriver): Promise<PrintResult> {
  let result: PrintResult;
  try {
    result = await getPrinter(driver).openDrawer();
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  reportDrawerResult(driver, result);
  return result;
}
