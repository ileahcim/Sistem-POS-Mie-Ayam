import { prisma } from "@/lib/prisma";

// "Mie Pasar" shortcut price (Rp/kg), owner-editable from /note/produk.
// Null when never set — the shortcut then shows "belum diisi" instead of
// inventing a number.
export async function getMiePasarPrice(): Promise<number | null> {
  const row = await prisma.mieSetting.findUnique({ where: { id: "singleton" } });
  return row?.pasarPricePerKg ?? null;
}
