import { notFound, redirect } from "next/navigation";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getSettings } from "@/lib/settings/get-settings";
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
  // A cancelled order has nothing left to act on — show its record instead.
  if (order.status === "CANCELLED") redirect(`/riwayat-pesanan/${order.id}`);

  const [menu, settings, orderAktifIndicator] = await Promise.all([
    getActiveMenu(),
    getSettings(),
    getOrderAktifIndicator(),
  ]);
  return (
    <PembayaranScreen
      order={order}
      menu={menu}
      autoPrintReceipt={settings.autoPrintReceipt}
      orderAktifIndicator={orderAktifIndicator}
    />
  );
}
