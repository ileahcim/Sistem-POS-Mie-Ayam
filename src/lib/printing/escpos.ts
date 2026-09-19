// Builds the raw ESC/POS byte payload for the Blueprint ECO80D (80mm paper,
// 48 columns per line at Font A) from the framework-agnostic ReceiptData /
// PackingListData shapes. Single source of truth for "what physically hits
// the paper" — both WebBluetoothPrinter and RawBtPrinter ship exactly these
// bytes, and the line layout mirrors src/components/printing/receipt-view.tsx
// / packing-list-view.tsx so the on-screen preview and the printed paper
// stay the same "brand" of receipt (see CLAUDE.md "Struk & printer").
//
// The web Bluetooth and RawBT raw passes are byte streams, not RawBT text
// mode, so all text is sanitised to single-byte ASCII first: Indonesian text
// is almost entirely ASCII, and the remaining Latin-1 / typographic chars
// are folded to their nearest ASCII lookalike instead of being sent raw as
// UTF-8 (which prints garble on an ESC/POS code page). Unmappable chars
// (emoji, etc.) become "?". This is the safe-enough choice for a thermal
// receipt; the copy on the database and screen is never touched.

import type { PackingListData, ReceiptData } from "./types";
import { formatRupiah, mergeReceiptItems, totalItemCount, groupAddonsForPrint, formatAddonWithQty } from "./format";
import { paperRule, centeredRule, RECEIPT_CHARS_PER_LINE } from "./paper";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";

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

// Latin-1 and common typographic chars Wisconsin-style folded onto ASCII so
// a 1-bit thermal code page can actually print them. Anything unmapped
// becomes "?".
const NON_ASCII_FOLD: Record<string, string> = {
  é: "e", è: "e", ê: "e", ë: "e",
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y",
  ñ: "n", ç: "c", ø: "o", æ: "ae", ß: "ss",
  "’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"',
  "–": "-", "—": "-", "…": "...", "•": "*",
  "×": "x", "÷": "/", "±": "+-", "°": " ", "²": "2", "³": "3",
  "½": "1/2", "¼": "1/4", "¾": "3/4", "€": "EUR", "£": "GBP",
};

// Keeps \n (we emit it ourselves for line breaks) and ASCII printable,
// folds the above, and drops \r outright.
function sanitizeText(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch === "\n") {
      out += "\n";
      continue;
    }
    if (ch === "\r") continue;
    const code = ch.codePointAt(0);
    if (code != null && code >= 0x20 && code <= 0x7e) {
      out += ch;
      continue;
    }
    out += NON_ASCII_FOLD[ch] ?? "?";
  }
  return out;
}

const ESC = 0x1b;

const INIT = Uint8Array.from([ESC, 0x40]); // ESC @ — reset printer
const JUSTIFY_LEFT = Uint8Array.from([ESC, 0x61, 0]); // ESC a 0
const JUSTIFY_CENTER = Uint8Array.from([ESC, 0x61, 1]); // ESC a 1
const BOLD_ON = Uint8Array.from([ESC, 0x45, 1]); // ESC E 1
const BOLD_OFF = Uint8Array.from([ESC, 0x45, 0]); // ESC E 0

// Feed the paper up n blank lines. The ECO80D's cutter is MANUAL
// ("Potongan kertas: not supported" in RawBT), so we never send a GS V cut
// command — just space the next/mounted receipt off the thermal head.
function feed(n: number): Uint8Array {
  return Uint8Array.from([ESC, 0x64, n]);
}

// No TextEncoder here on purpose: every character is guaranteed ASCII, and
// each code unit maps 1:1 to one printed column (12x24 dot font, 48 cols).
function asciiBytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i);
  return out;
}

function text(value: string): Uint8Array {
  return asciiBytes(sanitizeText(value));
}

function line(value = ""): Uint8Array {
  return text(`${value}\n`);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// "Multiplier x2" ............ "Rp22.000" — value glued to the right edge.
// If label + value overflow the line they are split onto two lines
// (label, then value right-aligned) instead of silently wrapping the price
// halfway across the paper. Newline inside the return is intended — line()
// appends the terminating \n and sanitizeText preserves interior \n.
function rightLine(label: string, value: string): string {
  const cols = RECEIPT_CHARS_PER_LINE;
  if (label.length + value.length + 1 <= cols) {
    return `${label}${" ".repeat(cols - label.length - value.length)}${value}`;
  }
  return `${label}\n${value.padStart(cols, " ")}`;
}

// "No. Order" : 67 — label column fixed at 10 chars, same as MetaRow's
// 10ch monospace width, so the colons line up down the block.
function metaLine(label: string, value: string): string {
  return `${label.padEnd(10)}: ${value}`;
}

export function buildReceiptBytes(data: ReceiptData): Uint8Array {
  const items = mergeReceiptItems(data.items);
  const addressLines = (data.address ?? "").split("\n").filter(Boolean);
  const tipe =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} - ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];

  const parts: Uint8Array[] = [INIT, JUSTIFY_CENTER, BOLD_ON, line(data.storeName), BOLD_OFF];
  for (const address of addressLines) parts.push(line(address));
  if (data.phone) parts.push(line(`Tel: ${data.phone}`));

  parts.push(
    JUSTIFY_LEFT,
    line(paperRule("=")),
    line(metaLine("No. Order", String(data.orderNumber))),
    line(metaLine("Tanggal", formatTanggal(data.printedAt))),
    line(metaLine("Jam", formatJam(data.printedAt))),
    line(metaLine("Kasir", data.kasirName)),
    line(metaLine("Tipe", tipe)),
    line(paperRule("=")),
  );

  // Nomor antrian sengaja tidak dicetak di struk (order sudah lunas — sama
  // seperti ReceiptView), jadi item jadi bagian tengah struktur ini.
  for (const item of items) {
    parts.push(line(rightLine(`${item.productName} x${item.qty}`, formatRupiah(item.lineTotal))));
    if (item.addons.length > 0) {
      parts.push(line(`  ${groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", ")}`));
    }
    if (item.notes) parts.push(line(`  "${item.notes}"`));
  }

  parts.push(
    line(paperRule("=")),
    line(`${totalItemCount(items)} item`),
    line(rightLine("Subtotal", formatRupiah(data.subtotal))),
  );
  if (data.deliveryFee > 0) {
    parts.push(line(paperRule("-")), line(rightLine("Ongkir", formatRupiah(data.deliveryFee))));
  }
  parts.push(
    line(paperRule("-")),
    BOLD_ON,
    line(rightLine("TOTAL", formatRupiah(data.total))),
    BOLD_OFF,
    line(paperRule("-")),
    line(rightLine(`Bayar (${PAYMENT_LABEL[data.paymentMethod]})`, formatRupiah(data.cashTendered ?? data.total))),
  );
  if (data.changeGiven != null && data.changeGiven > 0) {
    parts.push(line(rightLine("Kembali", formatRupiah(data.changeGiven))));
  }
  parts.push(
    line(paperRule("=")),
    JUSTIFY_CENTER,
    line(centeredRule(data.footerNote ?? "Terima kasih!")),
    feed(3),
  );

  return concat(...parts);
}

export function buildPackingListBytes(data: PackingListData): Uint8Array {
  const addressLines = (data.address ?? "").split("\n").filter(Boolean);
  const parts: Uint8Array[] = [INIT, JUSTIFY_CENTER, BOLD_ON, line(data.storeName), BOLD_OFF];
  for (const address of addressLines) parts.push(line(address));
  if (data.phone) parts.push(line(`Tel: ${data.phone}`));
  parts.push(BOLD_ON, line("DAFTAR PACKING"), BOLD_OFF);

  parts.push(
    JUSTIFY_LEFT,
    line(paperRule("=")),
    line(metaLine("No. Order", String(data.orderNumber))),
    line(
      metaLine("Antrian", data.queueNumber != null ? formatQueueLabel(data.queueNumber, data.queueSuffix) : "Belum dibayar"),
    ),
    line(metaLine("Tanggal", formatTanggal(data.printedAt))),
    line(metaLine("Jam", formatJam(data.printedAt))),
    line(metaLine("Tipe", `Antar${data.tableLabel ? ` - ${data.tableLabel}` : ""}`)),
    line(paperRule("=")),
  );

  // Daftar packing = checklist rakit order, belum ada pembayaran apa pun —
  // tidak ada harga, tidak ada total. Kotak centang "[ ]" di kiri, qty
  // dicetak rata kanan (angka yang disetor dapur pas merakit).
  for (const item of data.items) {
    parts.push(line(rightLine(`[ ] ${item.productName}`, `x${item.qty}`)));
    if (item.addons.length > 0) parts.push(line(`    ${item.addons.join(", ")}`));
    if (item.notes) parts.push(line(`    "${item.notes}"`));
  }
  parts.push(
    line(paperRule("=")),
    JUSTIFY_CENTER,
    line("Bukan bukti bayar"),
    feed(3),
  );

  return concat(...parts);
}