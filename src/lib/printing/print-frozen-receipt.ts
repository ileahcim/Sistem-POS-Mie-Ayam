"use client";

import { getPrinter } from "./get-printer";
import type { FrozenReceiptData, PrinterDriver } from "./types";

// Outcome of printing a Frozen receipt: null when the command went out,
// otherwise the reason. Never throws — a printer problem must never block
// a pickup/payment that's already saved (mirrors print-kitchen-ticket.ts).
export async function printFrozenReceiptSafely(
  driver: PrinterDriver,
  data: FrozenReceiptData,
): Promise<string | null> {
  try {
    const result = await getPrinter(driver).printFrozenReceipt(data);
    if (result.ok) return null;
    console.error("Cetak bukti Frozen gagal:", result.error);
    return result.error;
  } catch (error) {
    console.error("Cetak bukti Frozen gagal:", error);
    return error instanceof Error ? error.message : String(error);
  }
}
