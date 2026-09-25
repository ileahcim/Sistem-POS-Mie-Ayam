// Plain data shapes for what goes on a printout. Framework/hardware
// agnostic on purpose: the payment screen builds this data once, and any
// Printer implementation (mock, RawBT, Web Bluetooth) consumes the same
// shape without knowing where the data came from.

export type ReceiptChannel = "DINE_IN" | "BUNGKUS" | "ANTAR";
export type ReceiptPaymentMethod = "CASH" | "QRIS" | "TRANSFER" | "SPLIT";

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
  // Reading-order keys (lib/orders/line-order.ts) — the paper lists items in
  // the same order as the screens. Absent (test print) = keep given order.
  categorySortOrder?: number;
  productSortOrder?: number;
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
  // Order.customerName (nama tamu / pemesan pre-order). Absent or empty =
  // no "Nama" line at all, so a struk without a name is byte for byte what
  // it always was. Missing from this type until 25 Sep 2026 — the name was
  // stored on the order but never reached the paper.
  customerName?: string | null;
  logoRaster?: LogoRaster | null;
  // Owner-toggle: false menghapus logo dari struk (setelan "Cetak logo di
  // struk" di Pengaturan). Undefined/true = logo ikut dicetak. Dinolongkan
  // oleh logo-raster.ts withLogo, bukan di escpos.
  printLogo?: boolean;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number; // 0 when not applicable — still fine to compute a total from
  total: number;
  // null = a piutang ("Belum Bayar" / Tandai Piutang, 25 Sep 2026): the
  // struk is headed "BELUM LUNAS" and ends in a bold "Belum dibayar" line
  // instead of any "Bayar (...)" line, so it can never pass for a paid one.
  paymentMethod: ReceiptPaymentMethod | null;
  cashTendered?: number | null;
  changeGiven?: number | null;
  // Only set when paymentMethod === "SPLIT" — the struk then prints two
  // "Bayar (Cash)"/"Bayar (QRIS)" lines instead of one, see receipt-layout.ts.
  splitCashAmount?: number | null;
  splitQrisAmount?: number | null;
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
  // Reading-order keys, same as ReceiptItem. The price is only a sort key
  // here (cheapest variant first) — it is never printed on a packing list.
  categorySortOrder?: number;
  productSortOrder?: number;
  portionPrice?: number;
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

// "DAPUR" when the whole order is new, "TAMBAHAN" when only items just added
// to an already-saved order are on it (never the whole order again — the
// kitchen would cook it twice), "UBAH" when one existing line was edited in
// place (wrong topping etc.) — shows only the new version of that one line.
// See CLAUDE.md "Kertas dapur".
export type KitchenTicketKind = "FULL" | "ADDITIONAL" | "MODIFIED";

export type KitchenTicketItem = {
  productId: string; // groups per product, same rule as the cart (line-order.ts)
  productName: string;
  addons: string[]; // names only, no prices — this ticket never shows money
  notes?: string | null;
  qty: number;
  isDeliveryChargeable: boolean; // "is this a Makanan line" — the grouping flag GroupableLine uses
  categorySortOrder?: number;
  productSortOrder?: number;
  portionPrice?: number; // sort key only (cheapest variant first), never printed
};

// The kitchen ticket ("kertas dapur") — torn off and stuck near the stove,
// so it carries no store branding/logo, just what the kitchen needs: what
// to cook and which order it belongs to. Only Makanan/Minuman Racik lines
// ever reach this (isKitchenItem) — see build-kitchen-ticket-data.ts, which
// filters before this shape is even built.
export type KitchenTicketData = {
  kind: KitchenTicketKind;
  queueNumber: number | null; // null: a pre-order printed manually before it's paid
  queueSuffix: string;
  channel: ReceiptChannel;
  tableLabel?: string | null;
  customerName?: string | null;
  printedAt: Date;
  items: KitchenTicketItem[];
};

// "BUKTI PENGAMBILAN/PEMBAYARAN FROZEN" — the Buku Frozen's own small proof-
// of-transaction receipt (CLAUDE.md-worthy brief, 22 Sep 2026). One type with
// a `kind` discriminant rather than two separate types: the two receipts
// share the store header, customer name, date, one total-ish line and one
// debt-balance line, and only differ in title + 1-2 item lines — the same
// amount of abstraction as ReceiptData handling several payment shapes.
export type FrozenReceiptData = {
  storeName: string;
  address?: string | null;
  phone?: string | null;
  kind: "PENGAMBILAN" | "PEMBAYARAN";
  customerName: string;
  printedAt: Date;
  // PENGAMBILAN only:
  pcs?: number;
  pricePerPcs?: number;
  pickupTotal?: number;
  // PEMBAYARAN only:
  amountPaid?: number;
  // Both — the balance AFTER this transaction, always shown with an
  // explicit "Belum dibayar" (PENGAMBILAN) / "Sisa" (PEMBAYARAN) label,
  // never left implicit.
  debtAfter: number;
  logoRaster?: LogoRaster | null;
  printLogo?: boolean;
  footerNote?: string;
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
  printKitchenTicket(data: KitchenTicketData): Promise<PrintResult>;
  printFrozenReceipt(data: FrozenReceiptData): Promise<PrintResult>;
  // Raw ESC/POS bytes, for hardware diagnostics only (Tes Lebar Kolom) — real
  // receipts always go through printReceipt/printPackingList.
  printBytes(bytes: Uint8Array): Promise<PrintResult>;
}
