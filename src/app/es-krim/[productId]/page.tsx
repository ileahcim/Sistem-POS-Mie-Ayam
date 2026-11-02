import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";
import { getStockHistory } from "@/lib/stock/get-ice-cream";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { StockHistoryScreen } from "@/components/es-krim/stock-history-screen";

// Riwayat stok per produk — OWNER only, checked here server-side (it shows
// modal/box prices). Read-only: there is nothing to replay.
export default async function StockHistoryPage({ params }: { params: Promise<{ productId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/es-krim");

  const { productId } = await params;
  const product = await prisma.product.findFirst({
    where: { id: productId, tracksStock: true },
    select: { id: true, name: true, stock: true },
  });
  if (!product) notFound();

  const [rows, nav] = await Promise.all([getStockHistory(product.id), getHeaderNav()]);
  return <StockHistoryScreen product={product} rows={rows} nav={nav} />;
}
