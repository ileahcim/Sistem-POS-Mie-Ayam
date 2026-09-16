import { getReceivableOrders } from "@/lib/orders/get-receivable-orders";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { PiutangList } from "@/components/piutang/piutang-list";

export default async function PiutangPage() {
  const [orders, orderAktifIndicator] = await Promise.all([getReceivableOrders(), getOrderAktifIndicator()]);
  return <PiutangList orders={orders} orderAktifIndicator={orderAktifIndicator} />;
}
