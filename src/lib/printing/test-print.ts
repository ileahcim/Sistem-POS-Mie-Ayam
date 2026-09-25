"use client";

// One-click hardware testing: Pengaturan → "Tes Printer" and the
// "/print-preview" page both reuse these sample payloads so the operator can
// confirm the ECO80D end-to-end (pair the tablet first!) without ringing up
// a real order. Uses the same escpos.ts bytes as real receipts — a passing
// hardware test therefore proves the real auto-print will work too.

import type { PackingListData, PrinterDriver, PrintResult, ReceiptData } from "./types";
import type { StoreSettings } from "@/lib/settings/get-settings";
import { buildColumnTestBytes } from "./escpos";
import { getPrinter } from "./get-printer";

// The warung identity on a test print comes from the Setting table, exactly
// like a real struk (see buildReceiptData / buildPackingListData) — a test
// must never print a made-up shop name on real paper. Only the order lines
// below are sample data.
type TestPrintSettings = Pick<StoreSettings, "storeName" | "address" | "phone" | "receiptFooter" | "printLogo"> &
  Partial<Pick<StoreSettings, "cashChangeEnabled">>;

// printedAt is a raw instant (new Date()), which is always timezone-safe:
// escpos.ts and ReceiptView render it through formatId (explicit
// Asia/Jakarta), so the test prints the current WIB time whatever the
// tablet's OS timezone is set to. "Tunai"/"Kembali" appear exactly when a
// real Cash struk would have them: with "Hitung kembalian" on.
export function buildTestReceipt(settings: TestPrintSettings): ReceiptData {
  return {
    storeName: settings.storeName,
    address: settings.address,
    phone: settings.phone,
    orderNumber: 88,
    queueNumber: 8,
    queueSuffix: "",
    channel: "BUNGKUS",
    printedAt: new Date(),
    kasirName: "Budi",
    items: [
      {
        productName: "Mi Ayam Spesial",
        qty: 2,
        unitPrice: 15000,
        addons: [{ name: "Bakso", price: 2000 }],
        notes: "Pedas level 3, nggak pake sawi.",
        lineTotal: 34000,
      },
      {
        productName: "Es Teh Manis",
        qty: 1,
        unitPrice: 5000,
        addons: [],
        notes: "",
        lineTotal: 5000,
      },
    ],
    subtotal: 39000,
    deliveryFee: 0,
    total: 39000,
    paymentMethod: "CASH",
    ...(settings.cashChangeEnabled ? { cashTendered: 50000, changeGiven: 11000 } : {}),
    footerNote: settings.receiptFooter,
    printLogo: settings.printLogo,
  };
}

export function buildTestPackingList(settings: TestPrintSettings): PackingListData {
  return {
    storeName: settings.storeName,
    address: settings.address,
    phone: settings.phone,
    orderNumber: 88,
    queueNumber: 8,
    queueSuffix: "",
    printedAt: new Date(),
    // No tableLabel: the packing list is Antar-only, and Antar has no table.
    printLogo: settings.printLogo,
    items: [
      {
        productName: "Mi Ayam Spesial",
        qty: 2,
        addons: ["Bakso x1", "Pangsit x1"],
        notes: "Pedas level 3, nggak pake sawi.",
      },
      { productName: "Es Teh Manis", qty: 1, addons: [], notes: "" },
    ],
  };
}

export async function printTest(driver: PrinterDriver, settings: TestPrintSettings): Promise<PrintResult> {
  return getPrinter(driver).printReceipt(buildTestReceipt(settings));
}

export async function printPackingListTest(driver: PrinterDriver, settings: TestPrintSettings): Promise<PrintResult> {
  return getPrinter(driver).printPackingList(buildTestPackingList(settings));
}

// Hardware diagnostic (see buildColumnTestBytes): measure the real printable
// width instead of guessing. Not a receipt — no warung data, no order.
export async function printColumnTest(driver: PrinterDriver): Promise<PrintResult> {
  return getPrinter(driver).printBytes(buildColumnTestBytes());
}
