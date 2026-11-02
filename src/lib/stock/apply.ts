import type { Prisma } from "@/generated/prisma/client";
import type { StockKind } from "./types";

// The ONLY place Product.stock changes (docs/spec-es-krim.md "Logika stok").
// Every call runs inside the caller's interactive transaction, writes the
// StockMovement row that explains the change, and decrements only through a
// conditional update (stock >= qty) — so two tablets selling the last pcs at
// the same moment can't both succeed, and stock never goes negative (the DB
// CHECK constraint "Product_stock_nonnegative" is the second line of defence).

type Tx = Prisma.TransactionClient;

// Cashier-facing refusal. Thrown inside a transaction so the whole order /
// change rolls back; callers turn it into { ok: false, error }.
export class StockError extends Error {}

export type StockChange = {
  productId: string;
  delta: number; // signed pcs, never 0
  kind: StockKind;
  userId: string;
  orderId?: string | null;
  note?: string | null;
  takenBy?: string | null;
  boxes?: number | null;
  unitsPerBox?: number | null;
  boxPrice?: number | null;
};

export async function changeStock(tx: Tx, change: StockChange): Promise<{ stockAfter: number }> {
  const { productId, delta } = change;
  if (!Number.isInteger(delta) || delta === 0) throw new StockError("Jumlah tidak valid.");

  if (delta < 0) {
    const updated = await tx.product.updateMany({
      where: { id: productId, tracksStock: true, stock: { gte: -delta } },
      data: { stock: { decrement: -delta } },
    });
    if (updated.count === 0) {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stock: true, tracksStock: true } });
      if (!product || !product.tracksStock) throw new StockError("Produk ini tidak memakai stok.");
      throw new StockError(
        product.stock === 0
          ? `Stok ${product.name} habis.`
          : `Stok ${product.name} tidak cukup — tinggal ${product.stock} pcs.`,
      );
    }
  } else {
    const updated = await tx.product.updateMany({
      where: { id: productId, tracksStock: true },
      data: { stock: { increment: delta } },
    });
    if (updated.count === 0) throw new StockError("Produk ini tidak memakai stok.");
  }

  // Row is locked by the update above for the rest of this transaction, so
  // this reads exactly the value our own change produced.
  const after = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true, costPrice: true } });
  await tx.stockMovement.create({
    data: {
      productId,
      kind: change.kind,
      qtyChange: delta,
      stockAfter: after.stock,
      unitCost: after.costPrice,
      orderId: change.orderId ?? null,
      note: change.note ?? null,
      takenBy: change.takenBy ?? null,
      boxes: change.boxes ?? null,
      unitsPerBox: change.unitsPerBox ?? null,
      boxPrice: change.boxPrice ?? null,
      createdById: change.userId,
    },
  });
  return { stockAfter: after.stock };
}

export type StockLine = { productId: string | null; qty: number };

function sumByProduct(lines: StockLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId || line.qty === 0) continue;
    map.set(line.productId, (map.get(line.productId) ?? 0) + line.qty);
  }
  return map;
}

// Keeps stock in step with an order's lines. `removed` = order lines (or
// portions) taken off the order, `added` = lines put on it; the net per
// product is what moves — an edit that keeps an es krim at the same qty
// moves nothing. Net out of stock is a SALE, net back in is a SALE_RETURN.
// Products that don't track stock (everything except es krim) and custom
// items (productId null) are ignored, so callers can pass every line.
export async function syncOrderStock(
  tx: Tx,
  args: { removed?: StockLine[]; added?: StockLine[]; orderId: string; userId: string },
): Promise<void> {
  const removed = sumByProduct(args.removed ?? []);
  const added = sumByProduct(args.added ?? []);
  const ids = [...new Set([...removed.keys(), ...added.keys()])];
  if (ids.length === 0) return;

  const tracked = await tx.product.findMany({ where: { id: { in: ids }, tracksStock: true }, select: { id: true } });
  // Fixed order (by id) so two concurrent transactions lock rows in the same
  // sequence and can't deadlock each other.
  for (const { id } of tracked.sort((a, b) => a.id.localeCompare(b.id))) {
    const out = (added.get(id) ?? 0) - (removed.get(id) ?? 0);
    if (out === 0) continue;
    await changeStock(tx, {
      productId: id,
      delta: -out,
      kind: out > 0 ? "SALE" : "SALE_RETURN",
      orderId: args.orderId,
      userId: args.userId,
    });
  }
}
