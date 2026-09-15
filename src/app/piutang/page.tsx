import { getReceivableOrders } from "@/lib/orders/get-receivable-orders";
import { PiutangList } from "@/components/piutang/piutang-list";

export default async function PiutangPage() {
  const orders = await getReceivableOrders();
  return <PiutangList orders={orders} />;
}
