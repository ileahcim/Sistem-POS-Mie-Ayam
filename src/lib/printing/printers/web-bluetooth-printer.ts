"use client";

import type { Printer, PrintResult, ReceiptData, PackingListData } from "../types";

// NOT YET IMPLEMENTED, and likely a dead end for this printer — see the
// stage 1 trade-off notes. Web Bluetooth (navigator.bluetooth) can only talk
// to BLE/GATT devices; most cheap 80mm ESC/POS printers (possibly including
// the Blueprint ECO80D) use Bluetooth Classic SPP, which this API cannot
// reach at all. Keep this as a fallback experiment only if RawBtPrinter
// turns out not to work, and only after confirming the printer is BLE.
export class WebBluetoothPrinter implements Printer {
  async printReceipt(_data: ReceiptData): Promise<PrintResult> {
    return {
      ok: false,
      error: "WebBluetoothPrinter belum diimplementasikan — coba RawBtPrinter dulu.",
    };
  }

  async printPackingList(_data: PackingListData): Promise<PrintResult> {
    return {
      ok: false,
      error: "WebBluetoothPrinter belum diimplementasikan — coba RawBtPrinter dulu.",
    };
  }
}
