import { getUpcomingPreOrders } from "@/lib/orders/get-preorders";
import { getTomorrowPreorderRecap } from "@/lib/orders/get-tomorrow-preorder-recap";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { PesananTerjadwalList } from "@/components/pesanan-terjadwal/pesanan-terjadwal-list";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PesananTerjadwalPage() {
  const [orders, recap, nav] = await Promise.all([
    getUpcomingPreOrders(),
    getTomorrowPreorderRecap(),
    getHeaderNav(),
  ]);
  return <PesananTerjadwalList orders={orders} recap={recap} nav={nav} />;
}
