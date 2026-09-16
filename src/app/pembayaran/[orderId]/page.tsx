import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { PembayaranScreen } from "@/components/pembayaran/pembayaran-screen";

export default async function PembayaranPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const [menu, orderAktifIndicator] = await Promise.all([getActiveMenu(), getOrderAktifIndicator()]);
  return <PembayaranScreen order={order} menu={menu} orderAktifIndicator={orderAktifIndicator} />;
}
