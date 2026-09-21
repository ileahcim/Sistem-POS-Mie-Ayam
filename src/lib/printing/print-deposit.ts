"use client";

import { getPrinter } from "./get-printer";
import type { DepositReceiptData, PrinterDriver } from "./types";

// Outcome of printing a "BUKTI UANG MUKA" as plain text: null when the command
// went out, otherwise the reason. Never throws — a printer problem must never
// turn into an unhandled error on a DP that is already saved (same contract as
// the struk in the payment screen).
export async function printDepositReceiptSafely(
  driver: PrinterDriver,
  receipt: DepositReceiptData,
): Promise<string | null> {
  try {
    const result = await getPrinter(driver).printDepositReceipt(receipt);
    if (result.ok) return null;
    console.error("Cetak bukti DP gagal:", result.error);
    return result.error;
  } catch (error) {
    console.error("Cetak bukti DP gagal:", error);
    return error instanceof Error ? error.message : String(error);
  }
}
