"use client";

import type { DepositReceiptData, FrozenReceiptData, KitchenTicketData, Printer, PrintResult, ReceiptData, PackingListData } from "../types";

export type MockPrintJob =
  | { kind: "receipt"; data: ReceiptData }
  | { kind: "deposit-receipt"; data: DepositReceiptData }
  | { kind: "packing-list"; data: PackingListData }
  | { kind: "kitchen-ticket"; data: KitchenTicketData }
  | { kind: "frozen-receipt"; data: FrozenReceiptData };

type Listener = (job: MockPrintJob) => void;

// Module-level pub/sub so any Printer.printX() call anywhere in the app
// (payment screen, packing-list button, this dev preview page) shows up in
// a single always-mounted <MockPrinterOverlay/>, without threading a
// callback prop through every call site — the same call site works
// unchanged once a real printer replaces MockPrinter.
const listeners = new Set<Listener>();

export function subscribeMockPrinter(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class MockPrinter implements Printer {
  async printReceipt(data: ReceiptData): Promise<PrintResult> {
    for (const listener of listeners) listener({ kind: "receipt", data });
    return { ok: true };
  }

  async printDepositReceipt(data: DepositReceiptData): Promise<PrintResult> {
    for (const listener of listeners) listener({ kind: "deposit-receipt", data });
    return { ok: true };
  }

  async printPackingList(data: PackingListData): Promise<PrintResult> {
    for (const listener of listeners) listener({ kind: "packing-list", data });
    return { ok: true };
  }

  async printKitchenTicket(data: KitchenTicketData): Promise<PrintResult> {
    for (const listener of listeners) listener({ kind: "kitchen-ticket", data });
    return { ok: true };
  }

  async printFrozenReceipt(data: FrozenReceiptData): Promise<PrintResult> {
    for (const listener of listeners) listener({ kind: "frozen-receipt", data });
    return { ok: true };
  }

  // Raw bytes only mean something on a physical printer; there is nothing to
  // draw on screen for them.
  async printBytes(): Promise<PrintResult> {
    return { ok: false, error: "Tes ini butuh printer fisik — pilih mode Bluetooth atau RawBT dulu." };
  }
}
