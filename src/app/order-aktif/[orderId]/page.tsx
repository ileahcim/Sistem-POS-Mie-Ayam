import { notFound, redirect } from "next/navigation";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getSettings } from "@/lib/settings/get-settings";
import { buildPackingListData } from "@/lib/orders/build-packing-list-data";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { OrderDetail } from "@/components/order-aktif/order-detail";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();
  // A cancelled order has nothing left to act on — show its record instead.
  if (order.status === "CANCELLED") redirect(`/riwayat-pesanan/${order.id}`);

  const [menu, settings, orderAktifIndicator] = await Promise.all([
    getActiveMenu(),
    getSettings(),
    getOrderAktifIndicator(),
  ]);
  const packingList = order.channel === "ANTAR" ? buildPackingListData(order, settings) : null;

  return (
    <OrderDetail order={order} menu={menu} packingList={packingList} orderAktifIndicator={orderAktifIndicator} />
  );
}
