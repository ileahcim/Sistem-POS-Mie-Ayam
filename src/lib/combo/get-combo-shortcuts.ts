import { prisma } from "@/lib/prisma";
import type { ComboShortcut, ComboShortcutItem } from "./types";

// Cache-only read, never recomputed on the fly — see refresh-combo-cache.ts
// for when this table actually changes (shift close, once a day).
export async function getComboShortcuts(): Promise<ComboShortcut[]> {
  const rows = await prisma.comboCache.findMany({ orderBy: { salesCount30d: "desc" } });
  return rows.map((row) => ({
    comboKey: row.comboKey,
    displayName: row.displayName,
    totalPrice: row.totalPrice,
    salesCount30d: row.salesCount30d,
    items: row.items as unknown as ComboShortcutItem[],
  }));
}
