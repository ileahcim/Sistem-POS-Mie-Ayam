"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateHppItem(
  kind: "product" | "addon",
  id: string,
  data: { costPrice: number | null; costPriceEstimated: boolean; marginIntentional: boolean },
): Promise<ActionResult> {
  await requireRole("OWNER");

  if (data.costPrice != null && (!Number.isFinite(data.costPrice) || data.costPrice < 0)) {
    return { ok: false, error: "HPP tidak valid." };
  }

  if (kind === "product") {
    await prisma.product.update({ where: { id }, data });
  } else {
    await prisma.addonOption.update({ where: { id }, data });
  }
  return { ok: true };
}
