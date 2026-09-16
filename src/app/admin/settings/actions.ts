"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAutoPrintReceipt(autoPrintReceipt: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  await prisma.setting.update({ where: { id: "singleton" }, data: { autoPrintReceipt } });
  return { ok: true };
}
