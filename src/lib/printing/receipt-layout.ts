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
import { formatRupiah, mergeReceiptItems, totalItemCount, groupAddonsForPrint, formatAddonWithQty } from "./format";
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
export type PairRole = "item" | "plain" | "total" | "qty";

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
  // Name on the left, price/qty glued to the right edge.
  | { kind: "pair"; role: PairRole; left: string; right: string; checkbox?: boolean }
  // Indented line under an item: add-ons or a note. bold is only ever set by
  // the kitchen ticket's note line ("catatan dibuat menonjol") — a struk/DP
  // note stays plain, unaffected by this flag.
  | { kind: "sub"; text: string; role: "addon" | "note"; bold?: boolean };

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
const pair = (role: PairRole, left: string, right: string, checkbox = false): LayoutLine => ({
  kind: "pair",
  role,
  left,
  right,
  checkbox,
});

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
  ];

  for (const item of items) {
    lines.push(pair("item", `${item.qty}x ${item.productName}`, formatRupiah(item.lineTotal)));
    if (item.addons.length > 0) {
      lines.push({ kind: "sub", role: "addon", text: groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", ") });
    }
    if (item.notes) lines.push({ kind: "sub", role: "note", text: `"${item.notes}"` });
  }

  lines.push(rule("="), text(`${totalItemCount(items)} item`, "left", "body"), pair("plain", "Subtotal", formatRupiah(data.subtotal)));
  if (data.deliveryFee > 0) lines.push(rule("-"), pair("plain", "Ongkir", formatRupiah(data.deliveryFee)));
  lines.push(rule("-"), pair("total", "Total", formatRupiah(data.total)), rule("-"));
  const deposits = data.deposits ?? [];
  if (data.paymentMethod === null) {
    // Piutang: nothing was collected. Bold, right where "Bayar (...)" would
    // be, so the paper can't be read as settled.
    lines.push(pair("total", "Belum dibayar", formatRupiah(data.total)));
  } else if (deposits.length === 0) {
    if (data.paymentMethod === "SPLIT") {
      // Split payment (CLAUDE.md-worthy brief, 22 Sep 2026): two lines, one
      // per method actually collected — never the single "Bayar (...)" line.
      lines.push(
        pair("plain", "Bayar (Cash)", formatRupiah(data.splitCashAmount ?? 0)),
        pair("plain", "Bayar (QRIS)", formatRupiah(data.splitQrisAmount ?? 0)),
      );
    } else {
      // An ordinary order: byte for byte what it printed before DP existed.
      lines.push(pair("plain", `Bayar (${PAYMENT_LABEL[data.paymentMethod]})`, formatRupiah(data.cashTendered ?? data.total)));
      // Only ever set on an old order — payOrder no longer computes change.
      if (data.changeGiven != null && data.changeGiven > 0) {
        lines.push(pair("plain", "Kembali", formatRupiah(data.changeGiven)));
      }
    }
  } else {
    lines.push(...depositLines(deposits, data.total, data.paymentMethod, data.splitCashAmount, data.splitQrisAmount));
  }
  lines.push(rule("="), { kind: "rule", text: centeredRule(data.footerNote ?? "Terima kasih!") });
  return lines;
}

// The DP block of a struk lunas: each DP with the day and method it was paid,
// then what was actually collected now — or, when the order shrank below the DP,
// what has to go back to the customer. Never a silent Rp0.
// Heading of a piutang's struk (see ReceiptData.paymentMethod).
export const RECEIPT_UNPAID_HEADING = "BELUM LUNAS";

function depositLines(
  deposits: NonNullable<ReceiptData["deposits"]>,
  total: number,
  paymentMethod: ReceiptPaymentMethod,
  splitCashAmount: number | null | undefined,
  splitQrisAmount: number | null | undefined,
): LayoutLine[] {
  const position = depositPosition(total, deposits.map((d) => d.amount));
  const lines: LayoutLine[] = deposits.map((d) =>
    pair("plain", `DP ${formatTanggalPendek(d.receivedAt)}, ${PAYMENT_LABEL[d.method]}`, formatRupiah(d.amount)),
  );
  lines.push(rule("-"));
  if (position.excess > 0) {
    lines.push(pair("plain", "Kembalikan", formatRupiah(position.excess)));
  } else if (position.remainder > 0) {
    if (paymentMethod === "SPLIT") {
      // Split applies to the SISA only — the DP lines above are untouched.
      lines.push(
        pair("plain", "Bayar (Cash)", formatRupiah(splitCashAmount ?? 0)),
        pair("plain", "Bayar (QRIS)", formatRupiah(splitQrisAmount ?? 0)),
      );
    } else {
      lines.push(pair("plain", `Sisa dibayar (${PAYMENT_LABEL[paymentMethod]})`, formatRupiah(position.remainder)));
    }
  } else {
    // Fully covered by DP: nothing was collected, so no method to name.
    lines.push(pair("plain", "Sisa dibayar", formatRupiah(0)));
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
  ];

  for (const item of items) {
    lines.push(pair("item", `${item.qty}x ${item.productName}`, formatRupiah(item.lineTotal)));
    if (item.addons.length > 0) {
      lines.push({ kind: "sub", role: "addon", text: groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", ") });
    }
    if (item.notes) lines.push({ kind: "sub", role: "note", text: `"${item.notes}"` });
  }

  lines.push(rule("="), text(`${totalItemCount(items)} item`, "left", "body"), pair("plain", "Subtotal", formatRupiah(data.subtotal)));
  if (data.deliveryFee > 0) lines.push(rule("-"), pair("plain", "Ongkir", formatRupiah(data.deliveryFee)));
  lines.push(rule("-"), pair("total", "Total", formatRupiah(data.total)), rule("-"));

  for (const d of data.deposits) {
    lines.push(pair("plain", `DP ${formatTanggalPendek(d.receivedAt)}, ${PAYMENT_LABEL[d.method]}`, formatRupiah(d.amount)));
  }
  if (data.deposits.length > 1) lines.push(rule("-"), pair("plain", "Total DP", formatRupiah(position.held)));
  lines.push(rule("-"));
  if (position.excess > 0) lines.push(pair("total", "Dikembalikan saat diambil", formatRupiah(position.excess)));
  else lines.push(pair("total", "Sisa dibayar saat diambil", formatRupiah(position.remainder)));

  lines.push(rule("="), { kind: "rule", text: centeredRule(data.footerNote ?? "Terima kasih!") });
  return lines;
}

// "BUKTI PENGAMBILAN/PEMBAYARAN FROZEN" — the Buku Frozen's own small proof-
// of-transaction receipt (CLAUDE.md-worthy brief, 22 Sep 2026). Store header
// from Setting like a normal struk, but no queue number/order number at all
// (this isn't a POS order) — just who, when, what happened this time, and
// the balance after it, with an explicit bold "Belum dibayar"/"Sisa" line so
// it's never mistaken for a closed-out debt.
export function buildFrozenReceiptLayout(data: FrozenReceiptData): LayoutLine[] {
  const title = data.kind === "PENGAMBILAN" ? "BUKTI PENGAMBILAN FROZEN" : "BUKTI PEMBAYARAN FROZEN";
  const lines: LayoutLine[] = [
    ...headerLines(data, title),
    ...metaWrapped("Pelanggan", data.customerName),
    meta("Tanggal", formatTanggal(data.printedAt)),
    meta("Jam", formatJam(data.printedAt)),
    rule("="),
  ];

  if (data.kind === "PENGAMBILAN") {
    lines.push(
      pair("item", `${data.pcs ?? 0} pcs`, formatRupiah(data.pickupTotal ?? 0)),
      { kind: "sub", role: "addon", text: `${formatRupiah(data.pricePerPcs ?? 0)}/pcs` },
      rule("-"),
      pair("total", "Total", formatRupiah(data.pickupTotal ?? 0)),
      rule("-"),
      pair("total", "Belum dibayar", formatRupiah(data.debtAfter)),
    );
  } else {
    lines.push(
      pair("plain", "Dibayar", formatRupiah(data.amountPaid ?? 0)),
      rule("-"),
      pair("total", "Sisa", formatRupiah(data.debtAfter)),
    );
  }

  lines.push(rule("="), { kind: "rule", text: centeredRule(data.footerNote ?? "Terima kasih!") });
  return lines;
}

// Antar-only checklist printed BEFORE payment: no prices, no total.
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

  for (const item of sortOrderLines(data.items, (i) => i.portionPrice ?? 0)) {
    lines.push(pair("qty", item.productName, `x${item.qty}`, true));
    if (item.addons.length > 0) lines.push({ kind: "sub", role: "addon", text: item.addons.join(", ") });
    if (item.notes) lines.push({ kind: "sub", role: "note", text: `"${item.notes}"` });
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

  const { entries } = layoutOrderLines(sortOrderLines(data.items, (i) => i.portionPrice ?? 0));
  for (const entry of entries) {
    if (entry.kind === "line") {
      const item = entry.line;
      lines.push(text(`${item.qty}x ${item.productName}`, "left", "body"));
      if (item.addons.length > 0) lines.push({ kind: "sub", role: "addon", text: item.addons.join(", ") });
      // The only prominent line on this ticket besides the meta block — a
      // cook glancing at a stack of tickets must not miss "pedas banget".
      if (item.notes) lines.push({ kind: "sub", role: "note", text: `>> ${item.notes} <<`, bold: true });
    } else if (entry.kind === "groupTotal") {
      lines.push(text(`${entry.productName}: ${entry.portions} porsi`, "left", "heading"));
    } else {
      lines.push(rule("-"));
    }
  }

  lines.push(rule("="));
  return lines;
}
