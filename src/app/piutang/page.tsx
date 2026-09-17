import { getReceivableOrders } from "@/lib/orders/get-receivable-orders";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { PiutangList } from "@/components/piutang/piutang-list";

export default async function PiutangPage() {
  const [orders, nav] = await Promise.all([getReceivableOrders(), getHeaderNav()]);
  return <PiutangList orders={orders} nav={nav} />;
}
