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
// row-major, each row = widthDots/8 bytes, 8 horizontal dots per byte, MSB
// = leftmost dot — see the bit-order note in logo-raster.ts). Built in the browser from public/assets/logo-ctr-thermal.png by
// logo-raster.ts and attached by the client printers right before the bytes
// are dispatched — it never ships from the server (see escpos.ts).
export type LogoRaster = {
  widthDots: number; // must be a multiple of 8
  heightDots: number;
  bytes: Uint8Array;
};

// One DP (uang muka) the customer paid before the pre-order was collected.
export type ReceiptDeposit = {
  receivedAt: Date;
  method: ReceiptPaymentMethod;
  amount: number;
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
  // Owner-toggle: false menghapus logo dari struk (setelan "Cetak logo di
  // struk" di Pengaturan). Undefined/true = logo ikut dicetak. Dinolongkan
  // oleh logo-raster.ts withLogo, bukan di escpos.
  printLogo?: boolean;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number; // 0 when not applicable — still fine to compute a total from
  total: number;
  paymentMethod: ReceiptPaymentMethod;
  cashTendered?: number | null;
  changeGiven?: number | null;
  // DP received before this order was paid. Absent/empty for every ordinary
  // order — then the struk is exactly what it always was. When present, the
  // struk shows each DP under Total and the remainder actually paid now, and
  // `paymentMethod` is the method of that remainder.
  deposits?: ReceiptDeposit[];
  footerNote?: string;
};

// "BUKTI UANG MUKA" — handed to the customer when a DP is taken, printed
// before the order is paid (so it has no queue number and no payment method).
// `deposits` is every DP received up to and including the one this proof is
// for, oldest first: a customer who pays DP twice gets a proof per payment,
// each showing what has been paid so far.
export type DepositReceiptData = {
  storeName: string;
  address?: string | null;
  phone?: string | null;
  orderNumber: number;
  customerName: string;
  kasirName: string;
  printedAt: Date; // when THIS DP was received
  scheduledFor: Date; // pre-order delivery date/time
  channel: ReceiptChannel;
  tableLabel?: string | null;
  logoRaster?: LogoRaster | null;
  printLogo?: boolean;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deposits: ReceiptDeposit[];
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
  printLogo?: boolean;
  items: PackingListItem[];
};

export type PrintResult = { ok: true } | { ok: false; error: string };

// Which print driver is active. Declared here (not in get-printer.ts) so the
// server-side StoreSettings type can reference it too — get-printer.ts is a
// client module and must not leak into server code.
export type PrinterDriver = "mock" | "webbluetooth" | "rawbt";

export interface Printer {
  printReceipt(data: ReceiptData): Promise<PrintResult>;
  printDepositReceipt(data: DepositReceiptData): Promise<PrintResult>;
  printPackingList(data: PackingListData): Promise<PrintResult>;
  // Raw ESC/POS bytes, for hardware diagnostics only (Tes Lebar Kolom) — real
  // receipts always go through printReceipt/printPackingList.
  printBytes(bytes: Uint8Array): Promise<PrintResult>;
}
