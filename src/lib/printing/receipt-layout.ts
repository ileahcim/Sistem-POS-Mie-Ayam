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

import type { PackingListData, ReceiptData } from "./types";
import { formatRupiah, mergeReceiptItems, totalItemCount, groupAddonsForPrint, formatAddonWithQty } from "./format";
import { centeredRule, paperRule, wrapHeading, wrapWords, RECEIPT_CHARS_PER_LINE } from "./paper";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";

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
  // "No. Order : 113"
  | { kind: "meta"; label: string; value: string }
  // Name on the left, price/qty glued to the right edge.
  | { kind: "pair"; role: PairRole; left: string; right: string; checkbox?: boolean }
  // Indented line under an item: add-ons or a note.
  | { kind: "sub"; text: string; role: "addon" | "note" };

const CHANNEL_LABEL: Record<ReceiptData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

const PAYMENT_LABEL: Record<ReceiptData["paymentMethod"], string> = {
  CASH: "Cash",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
};

function formatTanggal(date: Date): string {
  return formatId(date, { day: "numeric", month: "short", year: "numeric" });
}

function formatJam(date: Date): string {
  return formatId(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}

const text = (value: string, align: "left" | "center", role: TextRole): LayoutLine => ({
  kind: "text",
  text: value,
  align,
  role,
});
const meta = (label: string, value: string): LayoutLine => ({ kind: "meta", label, value });
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

export function buildReceiptLayout(data: ReceiptData): LayoutLine[] {
  const items = mergeReceiptItems(data.items);
  const tipe =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} - ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];

  // No queue number on a struk: the order is paid, the queue only matters
  // before payment (it is on the daftar packing).
  const lines: LayoutLine[] = [
    ...headerLines(data),
    meta("No. Order", String(data.orderNumber)),
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
  lines.push(pair("plain", `Bayar (${PAYMENT_LABEL[data.paymentMethod]})`, formatRupiah(data.cashTendered ?? data.total)));
  // Only ever set on an old order — payOrder no longer computes change.
  if (data.changeGiven != null && data.changeGiven > 0) {
    lines.push(pair("plain", "Kembali", formatRupiah(data.changeGiven)));
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

  for (const item of data.items) {
    lines.push(pair("qty", item.productName, `x${item.qty}`, true));
    if (item.addons.length > 0) lines.push({ kind: "sub", role: "addon", text: item.addons.join(", ") });
    if (item.notes) lines.push({ kind: "sub", role: "note", text: `"${item.notes}"` });
  }

  lines.push(rule("="), text("Bukan bukti bayar", "center", "note"));
  return lines;
}
