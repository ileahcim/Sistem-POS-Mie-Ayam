import { prisma } from "@/lib/prisma";
import type { PrinterDriver } from "@/lib/printing/types";
import { POPULAR_COMBO_DEFAULT_MIN_SALES } from "@/lib/settings/popular-combo";

export type StoreSettings = {
  storeName: string;
  address: string | null;
  phone: string | null;
  receiptFooter: string;
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  autoPrintReceipt: boolean;
  sheetBlurEnabled: boolean;
  printerDriver: PrinterDriver;
  printLogo: boolean;
  preorderReminderMinutes: number;
  kitchenTicketEnabled: boolean;
  popularComboMinSales: number;
  cashChangeEnabled: boolean;
};

const FALLBACK: StoreSettings = {
  storeName: "Mie Ayam",
  address: null,
  phone: null,
  receiptFooter: "Terima kasih!",
  prepBaseMinutes: 4,
  prepMinutesPerPortion: 1,
  autoPrintReceipt: true,
  sheetBlurEnabled: true,
  printerDriver: "webbluetooth",
  printLogo: true,
  preorderReminderMinutes: 120,
  kitchenTicketEnabled: false,
  popularComboMinSales: POPULAR_COMBO_DEFAULT_MIN_SALES,
  cashChangeEnabled: true,
};

// The singleton row is created by prisma/seed.ts, but fall back gracefully
// rather than crashing the payment flow if it's ever missing.
// DB column is a plain String; the type union is enforced at write time by
// updatePrinterDriver's whitelist and at read time by this cast.
export async function getSettings(): Promise<StoreSettings> {
  const setting = await prisma.setting.findUnique({ where: { id: "singleton" } });
  if (!setting) return FALLBACK;
  return {
    storeName: setting.storeName,
    address: setting.address,
    phone: setting.phone,
    receiptFooter: setting.receiptFooter,
    prepBaseMinutes: setting.prepBaseMinutes,
    prepMinutesPerPortion: setting.prepMinutesPerPortion,
    autoPrintReceipt: setting.autoPrintReceipt,
    sheetBlurEnabled: setting.sheetBlurEnabled,
    printerDriver: setting.printerDriver as PrinterDriver,
    printLogo: setting.printLogo,
    preorderReminderMinutes: setting.preorderReminderMinutes,
    kitchenTicketEnabled: setting.kitchenTicketEnabled,
    popularComboMinSales: setting.popularComboMinSales,
    cashChangeEnabled: setting.cashChangeEnabled,
  };
}

// Read by the root layout on every request (sheet animation blur switch,
// see sheet-motion.tsx). Never allowed to break a page: any failure (no
// row, DB hiccup) just falls back to the default.
export async function getSheetBlurEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { id: "singleton" },
      select: { sheetBlurEnabled: true },
    });
    return setting?.sheetBlurEnabled ?? true;
  } catch {
    return true;
  }
}
