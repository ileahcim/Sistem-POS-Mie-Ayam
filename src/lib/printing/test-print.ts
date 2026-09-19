"use client";

// One-click hardware testing: Pengaturan → "Tes Printer" and the
// "/print-preview" page both reuse these sample payloads so the operator can
// confirm the ECO80D end-to-end (pair the tablet first!) without ringing up
// a real order. Uses the same escpos.ts bytes as real receipts — a passing
// hardware test therefore proves the real auto-print will work too.

import type { PackingListData, PrinterDriver, ReceiptData, PrintResult } from "./types";
import { getPrinter } from "./get-printer";

// Mirrors the original /print-preview sample source. Kasir/Tanggal dibikin
// fixed bertitel agar hasil print-menunjang kepastian tes hardware.
export function buildTestReceipt(): ReceiptData {
  return {
    storeName: "Mi Ayam Gacoan",
    address: "Jl. Merdeka No. 12",
    phone: "0812-3456-7890",
    orderNumber: 88,
    queueNumber: 8,
    queueSuffix: "",
    channel: "BUNGKUS",
    printedAt: new Date(2026, 8, 19, 12, 5),
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
    cashTendered: 50000,
    changeGiven: 11000,
    footerNote: "Terima kasih, setia dah!",
  };
}

export function buildTestPackingList(): PackingListData {
  return {
    storeName: "Mi Ayam Gacoan",
    address: "Jl. Merdeka No. 12",
    phone: "0812-3456-7890",
    orderNumber: 88,
    queueNumber: 8,
    queueSuffix: "",
    printedAt: new Date(2026, 8, 19, 12, 5),
    tableLabel: "Meja 3",
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

export async function printTest(driver: PrinterDriver): Promise<PrintResult> {
  return getPrinter(driver).printReceipt(buildTestReceipt());
}

export async function printPackingListTest(driver: PrinterDriver): Promise<PrintResult> {
  return getPrinter(driver).printPackingList(buildTestPackingList());
}