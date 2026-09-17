import { getUpcomingPreOrders } from "@/lib/orders/get-preorders";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { PesananTerjadwalList } from "@/components/pesanan-terjadwal/pesanan-terjadwal-list";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PesananTerjadwalPage() {
  const [orders, nav] = await Promise.all([getUpcomingPreOrders(), getHeaderNav()]);
  return <PesananTerjadwalList orders={orders} nav={nav} />;
}
