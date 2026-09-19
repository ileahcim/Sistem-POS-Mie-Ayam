// Plain data shapes for what goes on a printout. Framework/hardware
// agnostic on purpose: the payment screen builds this data once, and any
// Printer implementation (mock, RawBT, Web Bluetooth) consumes the same
// shape without knowing where the data came from.

export type ReceiptChannel = "DINE_IN" | "BUNGKUS" | "ANTAR";
export type ReceiptPaymentMethod = "CASH" | "QRIS" | "TRANSFER";

export type ReceiptAddon = {
  name: string;
  price: number;
};

export type ReceiptItem = {
  productName: string;
  addons: ReceiptAddon[]; // printed as an indented sub-line under the name
  notes?: string | null;
  qty: number;
  unitPrice: number; // base product price snapshot, before addons
  lineTotal: number; // (unitPrice + sum(addons.price)) * qty
};

// 1-bit raster of the store logo, ready for ESC/POS GS v 0 (bytes are
// row-major, each row = widthDots/8 bytes, 8 horizontal dots per byte, bit0
// leftmost). Built in the browser from public/assets/logo-ctr-mono.png by
// logo-raster.ts and attached by the client printers right before the bytes
// are dispatched — it never ships from the server (see escpos.ts).
export type LogoRaster = {
  widthDots: number; // must be a multiple of 8
  heightDots: number;
  bytes: Uint8Array;
};

export type ReceiptData = {
  storeName: string;
  address?: string | null; // may contain "\n" for a second address line
  phone?: string | null;
  orderNumber: number;
  queueNumber: number;
  queueSuffix: string; // "" normally, "A"/"B"/... for a Pisahkan & Bayar child — never printed on the receipt itself, only used elsewhere (Order Aktif, Riwayat)
  kasirName: string;
  printedAt: Date;
  channel: ReceiptChannel;
  tableLabel?: string | null;
  logoRaster?: LogoRaster | null;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number; // 0 when not applicable — still fine to compute a total from
  total: number;
  paymentMethod: ReceiptPaymentMethod;
  cashTendered?: number | null;
  changeGiven?: number | null;
  footerNote?: string;
};

// Antar-only packing list, printed before payment. No prices — it's a
// checklist for assembling the order, not proof of payment.
export type PackingListItem = {
  productName: string;
  addons: string[]; // names only, no prices
  notes?: string | null;
  qty: number;
};

export type PackingListData = {
  storeName: string;
  address?: string | null;
  phone?: string | null;
  orderNumber: number;
  queueNumber: number | null; // null: a pre-order not yet paid/attached to a shift
  queueSuffix: string;
  printedAt: Date;
  tableLabel?: string | null;
  logoRaster?: LogoRaster | null;
  items: PackingListItem[];
};

export type PrintResult = { ok: true } | { ok: false; error: string };

// Which print driver is active. Declared here (not in get-printer.ts) so the
// server-side StoreSettings type can reference it too — get-printer.ts is a
// client module and must not leak into server code.
export type PrinterDriver = "mock" | "webbluetooth" | "rawbt";

export interface Printer {
  printReceipt(data: ReceiptData): Promise<PrintResult>;
  printPackingList(data: PackingListData): Promise<PrintResult>;
}
