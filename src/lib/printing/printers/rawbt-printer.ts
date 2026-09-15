"use client";

import type { Printer, PrintResult, ReceiptData, PackingListData } from "../types";

// NOT YET IMPLEMENTED. Placeholder so the Printer interface has its intended
// second implementation on record and the factory in get-printer.ts type-checks.
//
// Planned approach once the printer arrives: build the ESC/POS (or RawBT's
// own markup) byte/text payload from ReceiptData/PackingListData, then
// navigate to a `rawbt:...` intent URL (or `intent://...#Intent;...;end`)
// so the RawBT Android app picks it up and prints over whichever transport
// (Bluetooth Classic SPP, BLE, or USB) it's paired with. This is the
// recommended first real driver to try — see the printing trade-off notes
// from stage 1 for why RawBT beats Web Bluetooth for this printer.
export class RawBtPrinter implements Printer {
  async printReceipt(_data: ReceiptData): Promise<PrintResult> {
    return {
      ok: false,
      error: "RawBtPrinter belum diimplementasikan — tunggu printer fisik datang.",
    };
  }

  async printPackingList(_data: PackingListData): Promise<PrintResult> {
    return {
      ok: false,
      error: "RawBtPrinter belum diimplementasikan — tunggu printer fisik datang.",
    };
  }
}
