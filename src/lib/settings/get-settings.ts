import { prisma } from "@/lib/prisma";

export type StoreSettings = {
  storeName: string;
  address: string | null;
  phone: string | null;
  receiptFooter: string;
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  autoPrintReceipt: boolean;
};

const FALLBACK: StoreSettings = {
  storeName: "Mie Ayam",
  address: null,
  phone: null,
  receiptFooter: "Terima kasih!",
  prepBaseMinutes: 4,
  prepMinutesPerPortion: 1,
  autoPrintReceipt: true,
};

// The singleton row is created by prisma/seed.ts, but fall back gracefully
// rather than crashing the payment flow if it's ever missing.
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
  };
}
