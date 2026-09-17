"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";

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
