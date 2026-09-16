"use client";

import { getPrinter } from "@/lib/printing/get-printer";
import type { ReceiptData, PackingListData } from "@/lib/printing/types";
import { Button } from "@/components/ui/button";

const STORE_NAME = "Mie Ayam Keluarga"; // TODO: ganti sesuai nama warung asli

function sampleReceipt(): ReceiptData {
  return {
    storeName: STORE_NAME,
    orderNumber: 118,
    queueNumber: 7,
    queueSuffix: "",
    printedAt: new Date(),
    channel: "DINE_IN",
    tableLabel: "K1",
    items: [
      {
        productName: "Mie Ayam",
        unitPrice: 13000,
        addons: [
          { name: "Bakso", price: 5000 },
          { name: "Pangsit", price: 2000 },
          { name: "Ceker", price: 2000 },
        ],
        qty: 1,
        lineTotal: 22000,
      },
      {
        productName: "Es Teh",
        unitPrice: 5000,
        addons: [],
        qty: 2,
        lineTotal: 10000,
      },
    ],
    subtotal: 32000,
    deliveryFee: 0,
    total: 32000,
    paymentMethod: "CASH",
    cashTendered: 50000,
    changeGiven: 18000,
  };
}

function samplePackingList(): PackingListData {
  return {
    storeName: STORE_NAME,
    orderNumber: 119,
    queueNumber: 8,
    queueSuffix: "",
    printedAt: new Date(),
    items: [
      {
        productName: "Mie Ayam",
        addons: ["Bakso", "Pangsit", "Ceker"],
        qty: 2,
      },
      {
        productName: "Es Teh",
        addons: [],
        qty: 2,
      },
    ],
  };
}

// Dev-only console for exercising the printing module without a real order
// flow yet. Stays useful after launch too — see MockPrinter's docblock.
export default function PrintPreviewPage() {
  const printer = getPrinter("mock");

  return (
    <div className="bg-canvas mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-bold text-ink">Print Preview (dev)</h1>
      <p className="text-ink-muted text-sm">
        Tombol di bawah memanggil <code>Printer.printReceipt()</code> /{" "}
        <code>printPackingList()</code> lewat <code>MockPrinter</code> — hasilnya
        muncul sebagai overlay, persis alur yang nanti dipakai RawBT/Web
        Bluetooth setelah printer fisik datang.
      </p>
      <Button variant="primary" size="large" onClick={() => printer.printReceipt(sampleReceipt())}>
        Contoh Struk Pembayaran
      </Button>
      <Button variant="ghost" size="large" onClick={() => printer.printPackingList(samplePackingList())}>
        Contoh Daftar Packing (Antar)
      </Button>
    </div>
  );
}
