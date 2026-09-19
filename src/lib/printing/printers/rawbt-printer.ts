"use client";

// RawBT print driver — the fallback for the Blueprint ECO80D when Web
// Bluetooth can't be used: iOS/Safari (no Web Bluetooth at all) or the rare
// case where the printer turns out to be Classic-SPP-only for BLE pairing.
// RawBT (package ru.a402d.rawbtprinter) receives the exact same ESC/POS
// bytes as the web Bluetooth driver (see escpos.ts) via an Android intent
// and pushes them over Classic SPP to the printer it was paired with in the
// RawBT app itself (Add printer → Bluetooth → ECO80D → Tes cetak).
//
// Honest status model: RawBT is an external app, so we can confirm "the
// bytes left this browser" and nothing more — a "print complete" claim would
// be a lie. On failure the status explains which step to fix (Chrome, play
// store, pairing, or the printer being off).
//
// Note to self (see catatan_update_opencode.md): RawBT free edition prints
// a small footer/watermark on every document; the paid license (~US$30)
// removes it. That only affects the RawBT path — the web Bluetooth path
// has no watermark — which is exactly why web bluetooth is the default.

import type { PackingListData, Printer, PrintResult, ReceiptData } from "../types";
import { buildPackingListBytes, buildReceiptBytes } from "../escpos";

function isAndroid(): boolean {
  // userAgentData is unreliable/absent on many devices and in tests; ua
  // sniffing with a simple regex is plenty for "should I fire an Android
  // intent?" — worst case a wrong answer just shows the guidance text.
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function sendToRawBt(bytes: Uint8Array): void {
  window.location.href = `intent:base64,${base64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
}

function transmitToRawBt(bytes: Uint8Array): PrintResult {
  if (!isAndroid()) {
    return {
      ok: false,
      error: "Mode RawBT hanya berjalan di perangkat Android. Gunakan mode Bluetooth (web Bluetooth) di tablet, atau pilih mode cetak lain.",
    };
  }
  sendToRawBt(bytes);
  // RawBT pergi menampilkan dirinya; status "terkirim" adalah yang bisa
  // dibuktikan dari sisi browser — cetak fisik dikonfirmasi kapan lagi
  // lewat Tes Cetak di app RawBT.
  return { ok: true };
}

export const rawBtPrinter: Printer = {
  async printReceipt(data: ReceiptData): Promise<PrintResult> {
    return transmitToRawBt(buildReceiptBytes(data));
  },

  async printPackingList(data: PackingListData): Promise<PrintResult> {
    return transmitToRawBt(buildPackingListBytes(data));
  },
};