"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import { isPreorderReminderChoice } from "@/lib/settings/preorder-reminder";
import { isPopularComboMinSalesChoice } from "@/lib/settings/popular-combo";
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

// "Hitung kembalian": on (default) = full-Cash payments, cash piutang
// settlements and cash DP ask for "Uang diterima" and show the change. Off =
// payment is exactly the old tap-method-tap-Bayar. Notes only either way —
// the drawer math never reads them (lib/orders/cash-change.ts).
export async function updateCashChangeEnabled(cashChangeEnabled: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  await prisma.setting.update({ where: { id: "singleton" }, data: { cashChangeEnabled } });
  return { ok: true };
}

// Off (default): the kitchen ticket feature is entirely invisible — no print
// prompt on save/tambah item, no "Cetak Tiket Dapur" button anywhere. See
// CLAUDE.md "Kertas dapur".
export async function updateKitchenTicketEnabled(kitchenTicketEnabled: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  await prisma.setting.update({ where: { id: "singleton" }, data: { kitchenTicketEnabled } });
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

// How early the red pre-order bar appears on the Kasir screen. The accepted
// values are a whitelist shared with the settings card — see
// lib/settings/preorder-reminder.ts for why it lives outside this file.
export async function updatePreorderReminderMinutes(minutes: number): Promise<ActionResult> {
  await requireRole("OWNER");
  if (!isPreorderReminderChoice(minutes)) {
    return { ok: false, error: "Pilihan waktu pengingat tidak dikenal." };
  }
  await prisma.setting.update({ where: { id: "singleton" }, data: { preorderReminderMinutes: minutes } });
  return { ok: true };
}

// "Menu Populer" threshold — how many sales in 30 days earn a combo a Kasir
// shortcut. Takes effect at the NEXT shift close (refreshComboCache is a
// once-a-day job, never triggered from a live screen so the shortcut row
// can't reshuffle mid-service — CLAUDE.md "Menu populer"). Accepted values
// are the whitelist shared with the settings card (lib/settings/popular-combo.ts).
export async function updatePopularComboMinSales(minSales: number): Promise<ActionResult> {
  await requireRole("OWNER");
  if (!isPopularComboMinSalesChoice(minSales)) {
    return { ok: false, error: "Pilihan ambang tidak dikenal." };
  }
  await prisma.setting.update({ where: { id: "singleton" }, data: { popularComboMinSales: minSales } });
  return { ok: true };
}

// Printed verbatim on every struk/daftar packing header (see
// receipt-layout.ts's headerLines) — never hardcoded in the print
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
