"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import type { PrinterDriver } from "@/lib/printing/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAutoPrintReceipt(autoPrintReceipt: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  await prisma.setting.update({ where: { id: "singleton" }, data: { autoPrintReceipt } });
  return { ok: true };
}

export async function updateSheetBlurEnabled(sheetBlurEnabled: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  await prisma.setting.update({ where: { id: "singleton" }, data: { sheetBlurEnabled } });
  return { ok: true };
}

const PRINTER_DRIVERS: PrinterDriver[] = ["mock", "webbluetooth", "rawbt"];

// Which driver the client printer factory will use from now on (see
// src/lib/printing/get-printer.ts). Whitelist from a single source of truth
// instead of trusting the client string.
export async function updatePrinterDriver(driver: PrinterDriver): Promise<ActionResult> {
  await requireRole("OWNER");
  if (!PRINTER_DRIVERS.includes(driver)) {
    return { ok: false, error: "Mode cetak tidak dikenal." };
  }
  await prisma.setting.update({ where: { id: "singleton" }, data: { printerDriver: driver } });
  return { ok: true };
}

// Print the store logo on the struk/daftar packing header or not — same
// on/off pattern as the other booleans on this page.
export async function updatePrintLogo(printLogo: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  await prisma.setting.update({ where: { id: "singleton" }, data: { printLogo } });
  return { ok: true };
}

// Printed verbatim on every struk/daftar packing header (see
// receipt-meta.tsx's ReceiptHeader) — never hardcoded in the print
// components themselves. Address is stored with its line breaks intact
// (a textarea in the UI) so a two-line address prints as two lines.
export async function updateStoreInfo(input: {
  storeName: string;
  address: string;
  phone: string;
}): Promise<ActionResult> {
  await requireRole("OWNER");

  const storeName = input.storeName.trim();
  if (!storeName) return { ok: false, error: "Nama warung wajib diisi." };

  await prisma.setting.update({
    where: { id: "singleton" },
    data: {
      storeName,
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
    },
  });
  return { ok: true };
}
