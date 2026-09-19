"use client";

// One-click hardware testing: Pengaturan → "Tes Printer" and the
// "/print-preview" page both reuse these sample payloads so the operator can
// confirm the ECO80D end-to-end (pair the tablet first!) without ringing up
// a real order. Uses the same escpos.ts bytes as real receipts — a passing
// hardware test therefore proves the real auto-print will work too.

import type { PackingListData, PrinterDriver, PrintResult, PrintTuning, ReceiptData } from "./types";
import type { StoreSettings } from "@/lib/settings/get-settings";
import { buildColumnTestBytes, buildSharpnessTestBytes } from "./escpos";
import { getPrinter } from "./get-printer";

// The warung identity on a test print comes from the Setting table, exactly
// like a real struk (see buildReceiptData / buildPackingListData) — a test
// must never print a made-up shop name on real paper. Only the order lines
// below are sample data.
type TestPrintSettings = Pick<StoreSettings, "storeName" | "address" | "phone" | "receiptFooter" | "printLogo" | "printTuning">;

// printedAt is a raw instant (new Date()), which is always timezone-safe:
// escpos.ts and ReceiptView render it through formatId (explicit
// Asia/Jakarta), so the test prints the current WIB time whatever the
// tablet's OS timezone is set to. No cashTendered/changeGiven: the real
// struk never has a "Kembali" line (CLAUDE.md "Pembayaran").
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
    footerNote: settings.receiptFooter,
    printLogo: settings.printLogo,
    tuning: settings.printTuning,
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
    tuning: settings.printTuning,
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

// Hardware diagnostics (see buildColumnTestBytes / buildSharpnessTestBytes):
// measure the real printable width and the print sharpness instead of
// guessing. Not receipts — no warung data, no order. They run under the saved
// tuning so they show what a real struk gets.
export async function printColumnTest(driver: PrinterDriver, tuning: PrintTuning): Promise<PrintResult> {
  return getPrinter(driver).printBytes(buildColumnTestBytes(tuning));
}

export async function printSharpnessTest(driver: PrinterDriver, tuning: PrintTuning): Promise<PrintResult> {
  return getPrinter(driver).printBytes(buildSharpnessTestBytes(tuning));
}
