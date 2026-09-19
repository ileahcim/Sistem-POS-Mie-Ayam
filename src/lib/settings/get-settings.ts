import { prisma } from "@/lib/prisma";
import type { PrinterDriver, PrintTuning } from "@/lib/printing/types";
import { NO_TUNING } from "@/lib/printing/tuning";

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
  printTuning: PrintTuning;
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
  printTuning: NO_TUNING,
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
    printTuning: {
      density: setting.printDensity,
      heatDots: setting.printHeatDots,
      heatTime: setting.printHeatTime,
      heatInterval: setting.printHeatInterval,
    },
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
