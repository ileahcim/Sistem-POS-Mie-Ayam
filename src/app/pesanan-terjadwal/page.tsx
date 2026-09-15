import { getUpcomingPreOrders } from "@/lib/orders/get-preorders";
import { PesananTerjadwalList } from "@/components/pesanan-terjadwal/pesanan-terjadwal-list";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PesananTerjadwalPage() {
  const orders = await getUpcomingPreOrders();
  return <PesananTerjadwalList orders={orders} />;
}
