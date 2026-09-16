import { getUpcomingPreOrders } from "@/lib/orders/get-preorders";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { PesananTerjadwalList } from "@/components/pesanan-terjadwal/pesanan-terjadwal-list";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PesananTerjadwalPage() {
  const [orders, orderAktifIndicator] = await Promise.all([getUpcomingPreOrders(), getOrderAktifIndicator()]);
  return <PesananTerjadwalList orders={orders} orderAktifIndicator={orderAktifIndicator} />;
}
