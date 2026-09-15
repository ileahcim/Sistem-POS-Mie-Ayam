import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getSettings } from "@/lib/settings/get-settings";
import { buildPackingListData } from "@/lib/orders/build-packing-list-data";
import { OrderDetail } from "@/components/order-aktif/order-detail";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const menu = await getActiveMenu();
  const packingList =
    order.channel === "ANTAR" ? buildPackingListData(order, await getSettings()) : null;

  return <OrderDetail order={order} menu={menu} packingList={packingList} />;
}
