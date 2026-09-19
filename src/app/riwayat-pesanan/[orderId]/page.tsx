import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { getSettings } from "@/lib/settings/get-settings";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { buildReceiptData } from "@/lib/orders/build-receipt-data";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { localDateStr } from "@/lib/timezone";
import { RiwayatDetail } from "@/components/riwayat-pesanan/riwayat-detail";

export default async function RiwayatDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [order, settings, user, nav] = await Promise.all([
    getOrderDetail(orderId),
    getSettings(),
    getCurrentUser(),
    getHeaderNav(),
  ]);
  if (!order) notFound();

  // Riwayat only ever shows a concluded order — same status set as
  // getOrderHistory's own list query — so a still-OPEN order id (it belongs
  // on Order Aktif, not here) 404s instead of leaking a half-built view.
  const isSettled = order.status !== "OPEN";
  if (!isSettled) notFound();

  const isOwner = user?.role === "OWNER";
  // Same "today only" boundary as the list (get-order-history.ts's
  // clampHistoryFilterForRole), enforced again here since this page is
  // reachable directly by id, not only through the filtered list — a
  // CASHIER guessing/pasting an old order's URL still gets nothing.
  if (!isOwner && localDateStr(new Date(order.createdAt)) !== localDateStr(new Date())) notFound();

  const receipt = order.status === "PAID" ? buildReceiptData(order, settings) : null;

  return (
    <RiwayatDetail order={order} receipt={receipt} printerDriver={settings.printerDriver} nav={nav} isOwner={isOwner} />
  );
}
