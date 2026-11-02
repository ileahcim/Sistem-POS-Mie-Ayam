// Single source of truth for WHAT a printout says — the order of its lines,
// every label, the date/time format, and which name goes with which price.
// Two renderers read the list this module builds and nothing else:
//   - components/printing/paper-view.tsx  → HTML preview (MockPrinter overlay)
//   - lib/printing/escpos.ts              → ESC/POS bytes for the real printer
// They may differ only in HOW a line is drawn (CSS font-weight vs an ESC/POS
// bold command, "□" vs "[ ]"), never in content or order. Before this module
// the two were written twice and drifted apart (thin raster rules on paper
// while the preview showed "====" rules, "Tel:" on paper only, no "DAFTAR
// PACKING" title on paper, ...). MockPrinter's ReceiptView is the reference.
//
// Pure data + formatting: no React, no ESC/POS, safe to import anywhere.

import type { DepositReceiptData, FrozenReceiptData, KitchenTicketData, PackingListData, ReceiptData, ReceiptPaymentMethod } from "./types";
import { mergeReceiptItems, totalItemCount, groupAddonsForPrint, formatAddonWithQty } from "./format";
import { centeredRule, paperRule, wrapHeading, wrapWords, RECEIPT_CHARS_PER_LINE } from "./paper";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { depositPosition } from "@/lib/deposits/settle";
import { portionPriceOf, sortOrderLines, layoutOrderLines } from "@/lib/orders/line-order";

// The thermal logo (see scripts/make-thermal-logo.py) is only the bowl and
// "CTR", 224 dots (≈28 mm) wide. No caption under it: the warung name from
// Setting is printed right below in sharp printer text, so a second line of
// branding was just noise.
export const RECEIPT_LOGO_SRC = "/assets/logo-ctr-thermal.png";
// Must match the asset (scripts/make-thermal-logo.py prints it when it runs).
// The printer reads the real size off the PNG; this is only so the preview can
// show the logo at the same fraction of the paper width it will really take.
export const RECEIPT_LOGO_WIDTH_DOTS = 224;

export type TextRole = "title" | "heading" | "small" | "body" | "note";

export type LayoutLine =
  // Logo image, or nothing at all when the device could not rasterise it.
  | { kind: "logo" }
  | { kind: "text"; text: string; align: "left" | "center"; role: TextRole }
  | { kind: "blank" }
  // A full-width line of literal characters: "====…", "----…", or the
  // centered "===== Terima kasih! =====" — the very string the printer gets.
  | { kind: "rule"; text: string }
  // "No. Order : 113". bold is only ever set by the kitchen ticket, whose
  // meta block (antrian/tipe/nama/jam) must stand out so the kitchen can
  // match the slip to the right table — every other caller leaves it unset.
  | { kind: "meta"; label: string; value: string; bold?: boolean }
  // A row already laid out in columns, never wider than the paper: an item
  // ("5x Mie Ayam Bakso   Rp 18.000   Rp 90.000"), its wrapped name/add-on
  // lines, a money row ("Total            Rp125.000"), a daftar packing row.
  // Both renderers print `text` verbatim, spaces included, so every column
  // lines up the same on paper and on screen (2 Nov 2026 — before, each
  // price was glued to the right edge on its own, so "Rp" wandered from row
  // to row and a long name wrapped mid-word wherever the printer broke it).
  //   bold      whole row bold (Total, kitchen note)
  //   boldTail  only the last N characters bold (daftar packing qty)
  //   checkbox  the row starts with "[ ] " — the preview draws a box there
  | { kind: "cols"; text: string; bold?: boolean; boldTail?: number; checkbox?: boolean };

const CHANNEL_LABEL: Record<ReceiptData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

const PAYMENT_LABEL: Record<ReceiptPaymentMethod, string> = {
  CASH: "Cash",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
  SPLIT: "Cash + QRIS",
};

function formatTanggal(date: Date): string {
  return formatId(date, { day: "numeric", month: "short", year: "numeric" });
}

function formatJam(date: Date): string {
  return formatId(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// "12 Sep" — the DP lines say when the money came in without the year.
function formatTanggalPendek(date: Date): string {
  return formatId(date, { day: "numeric", month: "short" });
}

const text = (value: string, align: "left" | "center", role: TextRole): LayoutLine => ({
  kind: "text",
  text: value,
  align,
  role,
});
const meta = (label: string, value: string, bold = false): LayoutLine => ({ kind: "meta", label, value, bold });
const rule = (char: "=" | "-"): LayoutLine => ({ kind: "rule", text: paperRule(char) });
const cols = (value: string, bold = false): LayoutLine => ({ kind: "cols", text: value, bold });

// ---------------------------------------------------------------------------
// Price columns. Every amount on one printout is drawn the same width:
// "Rp" first, then the number right-aligned in as many characters as the
// biggest number on that printout needs —
//   Rp 18.000
//   Rp  5.000
//   Rp125.000
// so "Rp" sits in one straight column and the digits line up on the right,
// down the item rows AND the Subtotal/Ongkir/Total/Bayar rows below them.
// ---------------------------------------------------------------------------

// Spaces between the harga satuan column and the line-total column.
const PRICE_COLUMN_GAP = 2;

type MoneyColumns = { width: number; money: (amount: number) => string };

function digitsOf(amount: number): string {
  const digits = Math.abs(amount).toLocaleString("id-ID");
  return amount < 0 ? `-${digits}` : digits;
}

// `amounts` = every number this printout may show (a superset is fine — it
// only ever makes the column as wide as the biggest one).
function moneyColumns(amounts: number[]): MoneyColumns {
  const digits = Math.max(1, ...amounts.map((a) => digitsOf(a).length));
  return { width: 2 + digits, money: (amount) => `Rp${digitsOf(amount).padStart(digits)}` };
}

// "Subtotal ......... Rp 95.000": label on the left, the amount in the
// line-total column. A label too long for the space (never in practice, but
// it is built from data) wraps per word below, the amount stays on row one.
function moneyRow(label: string, amount: number, money: MoneyColumns, bold = false): LayoutLine[] {
  const labelColumns = RECEIPT_CHARS_PER_LINE - money.width;
  const [first = "", ...rest] = wrapWords(label, labelColumns - 1);
  return [cols(first.padEnd(labelColumns) + money.money(amount), bold), ...rest.map((chunk) => cols(chunk, bold))];
}

type PricedRow = {
  prefix: string; // "5x" — padded so every name starts in the same column
  name: string;
  unitPrice: number; // harga satuan: one portion, add-ons included
  total: number;
  subs: string[]; // add-ons, a quoted note — under the name, never priced
};

// "5x Mie Ayam Bakso     Rp 18.000   Rp 90.000" — qty, name, harga satuan,
// total, all on the FIRST row. A name too long for its column is wrapped per
// word (never mid-word) and continues on the rows below, indented to line up
// with the name; add-ons and notes follow at the same indent.
function pricedRows(rows: PricedRow[], money: MoneyColumns): LayoutLine[] {
  const prefixWidth = Math.max(0, ...rows.map((r) => (r.prefix ? r.prefix.length + 1 : 0)));
  const nameWidth = RECEIPT_CHARS_PER_LINE - 2 * money.width - PRICE_COLUMN_GAP - 1 - prefixWidth;
  const indent = " ".repeat(prefixWidth);
  const lines: LayoutLine[] = [];
  for (const row of rows) {
    const [first = "", ...rest] = wrapWords(row.name, nameWidth);
    lines.push(
      cols(
        `${row.prefix.padEnd(prefixWidth)}${first.padEnd(nameWidth)} ${money.money(row.unitPrice)}${" ".repeat(PRICE_COLUMN_GAP)}${money.money(row.total)}`,
      ),
    );
    for (const chunk of rest) lines.push(cols(indent + chunk));
    for (const sub of row.subs) {
      for (const chunk of wrapWords(sub, RECEIPT_CHARS_PER_LINE - prefixWidth)) lines.push(cols(indent + chunk));
    }
  }
  return lines;
}

// Unpriced item rows (kertas dapur): same per-word wrap and indent as above.
function plainItemRows(
  rows: { prefix: string; name: string; subs: { text: string; bold?: boolean }[] }[],
): LayoutLine[] {
  const prefixWidth = Math.max(0, ...rows.map((r) => r.prefix.length + 1));
  const indent = " ".repeat(prefixWidth);
  const lines: LayoutLine[] = [];
  for (const row of rows) {
    const [first = "", ...rest] = wrapWords(row.name, RECEIPT_CHARS_PER_LINE - prefixWidth);
    lines.push(cols(row.prefix.padEnd(prefixWidth) + first));
    for (const chunk of rest) lines.push(cols(indent + chunk));
    for (const sub of row.subs) {
      for (const chunk of wrapWords(sub.text, RECEIPT_CHARS_PER_LINE - prefixWidth)) {
        lines.push(cols(indent + chunk, sub.bold ?? false));
      }
    }
  }
  return lines;
}

// One portion's price of a (merged) receipt line, add-ons included.
function unitPriceOf(item: { qty: number; lineTotal: number }): number {
  return item.qty > 0 ? Math.round(item.lineTotal / item.qty) : item.lineTotal;
}

function receiptPricedRows(items: ReceiptData["items"]): PricedRow[] {
  return items.map((item) => ({
    prefix: `${item.qty}x`,
    name: item.productName,
    unitPrice: unitPriceOf(item),
    total: item.lineTotal,
    subs: [
      ...(item.addons.length > 0 ? [groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", ")] : []),
      ...(item.notes ? [`"${item.notes}"`] : []),
    ],
  }));
}

// Logo block + store identity, shared by struk and daftar packing. Store name,
// address and phone come from Setting (never hardcoded here). `heading` is the
// document title of a daftar packing, which a struk doesn't have.
function headerLines(
  data: { storeName: string; address?: string | null; phone?: string | null; printLogo?: boolean },
  heading?: string,
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  // Line breaks the owner typed in Setting are kept; each of those is then
  // wrapped to the paper so a long name/address can never run off the edge
  // (and the name is balanced across its lines — see wrapHeading).
  if (data.printLogo !== false) lines.push({ kind: "logo" }, { kind: "blank" });
  for (const line of data.storeName.split("\n").filter(Boolean)) {
    for (const name of wrapHeading(line)) lines.push(text(name, "center", "title"));
  }
  for (const line of (data.address ?? "").split("\n").filter(Boolean)) {
    for (const address of wrapWords(line, RECEIPT_CHARS_PER_LINE)) lines.push(text(address, "center", "small"));
  }
  if (data.phone) {
    for (const phone of wrapWords(data.phone, RECEIPT_CHARS_PER_LINE)) lines.push(text(phone, "center", "small"));
  }
  lines.push({ kind: "blank" });
  if (heading) lines.push(text(heading, "center", "heading"));
  lines.push(rule("="));
  return lines;
}

// Identical lines merged, then the same reading order as every screen
// (category, product, cheapest variant first — see line-order.ts). The paper
// used to keep creation order; the owner asked for it to follow the screens
// (21 Sep 2026). Only the ORDER is shared: the per-product counts and dashed
// dividers of the screens are never printed.
function receiptItemsInReadingOrder(items: ReceiptData["items"]): ReceiptData["items"] {
  return sortOrderLines(mergeReceiptItems(items), portionPriceOf);
}

export function buildReceiptLayout(data: ReceiptData): LayoutLine[] {
  const items = receiptItemsInReadingOrder(data.items);
  const tipe =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} - ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];
  const deposits = data.deposits ?? [];
  const position = depositPosition(data.total, deposits.map((d) => d.amount));
  const money = moneyColumns([
    ...items.flatMap((i) => [unitPriceOf(i), i.lineTotal]),
    data.subtotal,
    data.deliveryFee,
    data.total,
    data.splitCashAmount ?? 0,
    data.splitQrisAmount ?? 0,
    data.cashTendered ?? 0,
    data.changeGiven ?? 0,
    ...deposits.map((d) => d.amount),
    position.excess,
    position.remainder,
  ]);

  // No queue number on a struk: the order is paid, the queue only matters
  // before payment (it is on the daftar packing).
  const unpaid = data.paymentMethod === null;
  const lines: LayoutLine[] = [
    ...headerLines(data, unpaid ? RECEIPT_UNPAID_HEADING : undefined),
    meta("No. Order", String(data.orderNumber)),
    // Long names continue on the next line under the value, same as the
    // Bukti Uang Muka's "Pemesan" — never past the paper's edge.
    ...(data.customerName?.trim() ? metaWrapped("Nama", data.customerName.trim()) : []),
    meta("Tanggal", formatTanggal(data.printedAt)),
    meta("Jam", formatJam(data.printedAt)),
    meta("Kasir", data.kasirName),
    meta("Tipe", tipe),
    rule("="),
    ...pricedRows(receiptPricedRows(items), money),
    rule("="),
    text(`${totalItemCount(items)} item`, "left", "body"),
    ...moneyRow("Subtotal", data.subtotal, money),
  ];
  if (data.deliveryFee > 0) lines.push(rule("-"), ...moneyRow("Ongkir", data.deliveryFee, money));
  lines.push(rule("-"), ...moneyRow("Total", data.total, money, true), rule("-"));
  if (data.paymentMethod === null) {
    // Piutang: nothing was collected. Bold, right where "Bayar (...)" would
    // be, so the paper can't be read as settled.
    lines.push(...moneyRow("Belum dibayar", data.total, money, true));
  } else if (deposits.length === 0) {
    if (data.paymentMethod === "SPLIT") {
      // Split payment (22 Sep 2026): two lines, one per method actually
      // collected — never the single "Bayar (...)" line.
      lines.push(
        ...moneyRow("Bayar (Cash)", data.splitCashAmount ?? 0, money),
        ...moneyRow("Bayar (QRIS)", data.splitQrisAmount ?? 0, money),
      );
    } else if (data.cashTendered != null) {
      // "Hitung kembalian" (26 Sep 2026): what was handed over and what went
      // back, in place of "Bayar (Cash)".
      lines.push(...tenderedLines(data.cashTendered, data.changeGiven, money));
    } else {
      lines.push(...moneyRow(`Bayar (${PAYMENT_LABEL[data.paymentMethod]})`, data.total, money));
    }
  } else {
    lines.push(...depositLines(deposits, position, data.paymentMethod, data.splitCashAmount, data.splitQrisAmount, money));
    if (data.cashTendered != null) lines.push(...tenderedLines(data.cashTendered, data.changeGiven, money));
  }
  lines.push(rule("="), { kind: "rule", text: centeredRule(data.footerNote ?? "Terima kasih!") });
  return lines;
}

// "Tunai" / "Kembali" of a cash payment taken with "Hitung kembalian" — the
// struk, the sisa after DP, and the Bukti Uang Muka all print the same pair.
function tenderedLines(cashTendered: number, changeGiven: number | null | undefined, money: MoneyColumns): LayoutLine[] {
  return [...moneyRow("Tunai", cashTendered, money), ...moneyRow("Kembali", changeGiven ?? 0, money)];
}

// Heading of a piutang's struk (see ReceiptData.paymentMethod).
export const RECEIPT_UNPAID_HEADING = "BELUM LUNAS";

// The DP block of a struk lunas: each DP with the day and method it was paid,
// then what was actually collected now — or, when the order shrank below the DP,
// what has to go back to the customer. Never a silent Rp0.
function depositLines(
  deposits: NonNullable<ReceiptData["deposits"]>,
  position: ReturnType<typeof depositPosition>,
  paymentMethod: ReceiptPaymentMethod,
  splitCashAmount: number | null | undefined,
  splitQrisAmount: number | null | undefined,
  money: MoneyColumns,
): LayoutLine[] {
  const lines: LayoutLine[] = deposits.flatMap((d) =>
    moneyRow(`DP ${formatTanggalPendek(d.receivedAt)}, ${PAYMENT_LABEL[d.method]}`, d.amount, money),
  );
  lines.push(rule("-"));
  if (position.excess > 0) {
    lines.push(...moneyRow("Kembalikan", position.excess, money));
  } else if (position.remainder > 0) {
    if (paymentMethod === "SPLIT") {
      // Split applies to the SISA only — the DP lines above are untouched.
      lines.push(
        ...moneyRow("Bayar (Cash)", splitCashAmount ?? 0, money),
        ...moneyRow("Bayar (QRIS)", splitQrisAmount ?? 0, money),
      );
    } else {
      lines.push(...moneyRow(`Sisa dibayar (${PAYMENT_LABEL[paymentMethod]})`, position.remainder, money));
    }
  } else {
    // Fully covered by DP: nothing was collected, so no method to name.
    lines.push(...moneyRow("Sisa dibayar", 0, money));
  }
  return lines;
}

// A value too long for the meta column (a customer name is free text) is
// continued on the lines below, aligned under the value. Those lines are
// "rule" lines because that kind is the literal-characters line both renderers
// already keep verbatim, spaces included.
function metaWrapped(label: string, value: string): LayoutLine[] {
  const META_LABEL_COLUMNS = 10 + 2; // "label     : " — see metaLine / MetaRow
  const [first = "", ...rest] = wrapWords(value, RECEIPT_CHARS_PER_LINE - META_LABEL_COLUMNS);
  return [meta(label, first), ...rest.map((chunk): LayoutLine => ({ kind: "rule", text: " ".repeat(META_LABEL_COLUMNS) + chunk }))];
}

// "BUKTI UANG MUKA" — given to the customer when a DP is taken. Not a struk:
// nothing is paid in full yet, so there is no payment line and no queue number
// (a pre-order has none until it is paid); the customer keeps it as proof
// until they collect the order. What they still owe is the last, bold line.
export function buildDepositReceiptLayout(data: DepositReceiptData): LayoutLine[] {
  const items = receiptItemsInReadingOrder(data.items);
  const tipe =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} - ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];
  const position = depositPosition(data.total, data.deposits.map((d) => d.amount));
  const money = moneyColumns([
    ...items.flatMap((i) => [unitPriceOf(i), i.lineTotal]),
    data.subtotal,
    data.deliveryFee,
    data.total,
    ...data.deposits.map((d) => d.amount),
    data.cashTendered ?? 0,
    data.changeGiven ?? 0,
    position.held,
    position.excess,
    position.remainder,
  ]);

  const lines: LayoutLine[] = [
    ...headerLines(data, "BUKTI UANG MUKA"),
    meta("No. Order", String(data.orderNumber)),
    ...metaWrapped("Pemesan", data.customerName),
    meta("Tanggal", formatTanggal(data.printedAt)),
    meta("Jam", formatJam(data.printedAt)),
    meta("Kasir", data.kasirName),
    meta("Tipe", tipe),
    meta("Kirim", `${formatTanggal(data.scheduledFor)}, ${formatJam(data.scheduledFor)}`),
    rule("="),
    ...pricedRows(receiptPricedRows(items), money),
    rule("="),
    text(`${totalItemCount(items)} item`, "left", "body"),
    ...moneyRow("Subtotal", data.subtotal, money),
  ];
  if (data.deliveryFee > 0) lines.push(rule("-"), ...moneyRow("Ongkir", data.deliveryFee, money));
  lines.push(rule("-"), ...moneyRow("Total", data.total, money, true), rule("-"));

  for (const d of data.deposits) {
    lines.push(...moneyRow(`DP ${formatTanggalPendek(d.receivedAt)}, ${PAYMENT_LABEL[d.method]}`, d.amount, money));
  }
  // This proof's own DP is the last row above; its Tunai/Kembali sit under it.
  if (data.cashTendered != null) lines.push(...tenderedLines(data.cashTendered, data.changeGiven, money));
  if (data.deposits.length > 1) lines.push(rule("-"), ...moneyRow("Total DP", position.held, money));
  lines.push(rule("-"));
  if (position.excess > 0) lines.push(...moneyRow("Dikembalikan saat diambil", position.excess, money, true));
  else lines.push(...moneyRow("Sisa dibayar saat diambil", position.remainder, money, true));

  lines.push(rule("="), { kind: "rule", text: centeredRule(data.footerNote ?? "Terima kasih!") });
  return lines;
}

// "BUKTI PENGAMBILAN/PEMBAYARAN FROZEN" — the Buku Frozen's own small proof-
// of-transaction receipt (22 Sep 2026). Store header from Setting like a
// normal struk, but no queue number/order number at all (this isn't a POS
// order) — just who, when, what happened this time, and the balance after
// it, with an explicit bold "Belum dibayar"/"Sisa" line so it's never
// mistaken for a closed-out debt.
export function buildFrozenReceiptLayout(data: FrozenReceiptData): LayoutLine[] {
  const title = data.kind === "PENGAMBILAN" ? "BUKTI PENGAMBILAN FROZEN" : "BUKTI PEMBAYARAN FROZEN";
  const money = moneyColumns([data.pricePerPcs ?? 0, data.pickupTotal ?? 0, data.amountPaid ?? 0, data.debtAfter]);
  const lines: LayoutLine[] = [
    ...headerLines(data, title),
    ...metaWrapped("Pelanggan", data.customerName),
    meta("Tanggal", formatTanggal(data.printedAt)),
    meta("Jam", formatJam(data.printedAt)),
    rule("="),
  ];

  if (data.kind === "PENGAMBILAN") {
    lines.push(
      // Harga/pcs in the harga satuan column, like a struk item row.
      ...pricedRows(
        [{ prefix: "", name: `${data.pcs ?? 0} pcs`, unitPrice: data.pricePerPcs ?? 0, total: data.pickupTotal ?? 0, subs: [] }],
        money,
      ),
      rule("-"),
      ...moneyRow("Total", data.pickupTotal ?? 0, money, true),
      rule("-"),
      ...moneyRow("Belum dibayar", data.debtAfter, money, true),
    );
  } else {
    lines.push(
      ...moneyRow("Dibayar", data.amountPaid ?? 0, money),
      rule("-"),
      ...moneyRow("Sisa", data.debtAfter, money, true),
    );
  }

  lines.push(rule("="), { kind: "rule", text: centeredRule(data.footerNote ?? "Terima kasih!") });
  return lines;
}

// Antar-only checklist printed BEFORE payment: no prices, no total (owner,
// confirmed again 2 Nov 2026). "[ ] Mie Ayam ... x5" with the qty bold on the
// right edge; a long name wraps per word and continues under itself.
export function buildPackingListLayout(data: PackingListData): LayoutLine[] {
  const lines: LayoutLine[] = [
    ...headerLines(data, "DAFTAR PACKING"),
    meta("No. Order", String(data.orderNumber)),
    meta("Antrian", data.queueNumber != null ? formatQueueLabel(data.queueNumber, data.queueSuffix) : "Belum dibayar"),
    meta("Tanggal", formatTanggal(data.printedAt)),
    meta("Jam", formatJam(data.printedAt)),
    meta("Tipe", `Antar${data.tableLabel ? ` - ${data.tableLabel}` : ""}`),
    rule("="),
  ];

  const items = sortOrderLines(data.items, (i) => i.portionPrice ?? 0);
  const box = "[ ] ";
  const indent = " ".repeat(box.length);
  const qtyWidth = Math.max(0, ...items.map((i) => `x${i.qty}`.length));
  const nameWidth = RECEIPT_CHARS_PER_LINE - box.length - 1 - qtyWidth;
  for (const item of items) {
    const [first = "", ...rest] = wrapWords(item.productName, nameWidth);
    lines.push({
      kind: "cols",
      text: `${box}${first.padEnd(nameWidth)} ${`x${item.qty}`.padStart(qtyWidth)}`,
      boldTail: qtyWidth,
      checkbox: true,
    });
    for (const chunk of rest) lines.push(cols(indent + chunk));
    const subs = [...(item.addons.length > 0 ? [item.addons.join(", ")] : []), ...(item.notes ? [`"${item.notes}"`] : [])];
    for (const sub of subs) {
      for (const chunk of wrapWords(sub, RECEIPT_CHARS_PER_LINE - box.length)) lines.push(cols(indent + chunk));
    }
  }

  lines.push(rule("="), text("Bukan bukti bayar", "center", "note"));
  return lines;
}

const KITCHEN_TICKET_TITLE: Record<KitchenTicketData["kind"], string> = {
  FULL: "DAPUR",
  ADDITIONAL: "TAMBAHAN",
  MODIFIED: "UBAH",
};

// The kitchen slip — see CLAUDE.md "Kertas dapur". No store header/logo (it
// never leaves the building), so this is the shortest of the four printouts:
// a bold title + meta block the kitchen can match against the table, then
// the items — grouped per product exactly like the cart/struk (line-order.ts,
// same GROUPING_VISIBLE_FROM threshold), never with prices.
export function buildKitchenTicketLayout(data: KitchenTicketData): LayoutLine[] {
  const tipe =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} - ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];

  const lines: LayoutLine[] = [
    text(KITCHEN_TICKET_TITLE[data.kind], "center", "heading"),
    rule("="),
    meta("Antrian", data.queueNumber != null ? formatQueueLabel(data.queueNumber, data.queueSuffix) : "Pre-order", true),
    meta("Tipe", tipe, true),
    ...(data.customerName ? [meta("Nama", data.customerName, true)] : []),
    meta("Jam", formatJam(data.printedAt), true),
    rule("="),
  ];

  const sorted = sortOrderLines(data.items, (i) => i.portionPrice ?? 0);
  // One qty column for the whole slip, so every name starts in the same column.
  const prefixOf = (item: { qty: number }) => `${item.qty}x`;
  const prefixWidth = Math.max(0, ...sorted.map((i) => prefixOf(i).length));
  const { entries } = layoutOrderLines(sorted);
  for (const entry of entries) {
    if (entry.kind === "line") {
      const item = entry.line;
      lines.push(
        ...plainItemRows([
          {
            prefix: prefixOf(item).padEnd(prefixWidth),
            name: item.productName,
            subs: [
              ...(item.addons.length > 0 ? [{ text: item.addons.join(", ") }] : []),
              // The only prominent line on this ticket besides the meta block —
              // a cook glancing at a stack of tickets must not miss "pedas banget".
              ...(item.notes ? [{ text: `>> ${item.notes} <<`, bold: true }] : []),
            ],
          },
        ]),
      );
    } else if (entry.kind === "groupTotal") {
      lines.push(text(`${entry.productName}: ${entry.portions} porsi`, "left", "heading"));
    } else {
      lines.push(rule("-"));
    }
  }

  lines.push(rule("="));
  return lines;
}
