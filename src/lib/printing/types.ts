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

export type ReceiptData = {
  storeName: string;
  orderNumber: number;
  queueNumber: number;
  queueSuffix: string; // "" normally, "A"/"B"/... for a Pisahkan & Bayar child
  printedAt: Date;
  channel: ReceiptChannel;
  tableLabel?: string | null;
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
  orderNumber: number;
  queueNumber: number | null; // null: a pre-order not yet paid/attached to a shift
  queueSuffix: string;
  printedAt: Date;
  tableLabel?: string | null;
  items: PackingListItem[];
};

export type PrintResult = { ok: true } | { ok: false; error: string };

export interface Printer {
  printReceipt(data: ReceiptData): Promise<PrintResult>;
  printPackingList(data: PackingListData): Promise<PrintResult>;
}
