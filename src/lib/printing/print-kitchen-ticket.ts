"use client";

import { getPrinter } from "./get-printer";
import type { KitchenTicketData, PrinterDriver } from "./types";

// Outcome of printing a kitchen ticket as plain text: null when the command
// went out, otherwise the reason. Never throws — a printer problem must
// never block/undo an order that is already saved (same contract as the
// struk and the DP proof).
export async function printKitchenTicketSafely(
  driver: PrinterDriver,
  ticket: KitchenTicketData,
): Promise<string | null> {
  try {
    const result = await getPrinter(driver).printKitchenTicket(ticket);
    if (result.ok) return null;
    console.error("Cetak tiket dapur gagal:", result.error);
    return result.error;
  } catch (error) {
    console.error("Cetak tiket dapur gagal:", error);
    return error instanceof Error ? error.message : String(error);
  }
}
