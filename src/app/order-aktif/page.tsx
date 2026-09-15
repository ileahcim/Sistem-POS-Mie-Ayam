import { getActiveOrders, getUnpaidServedOrders } from "@/lib/orders/get-active-orders";
import { getSettings } from "@/lib/settings/get-settings";
import { OrderAktifList } from "@/components/order-aktif/order-aktif-list";

export default async function OrderAktifPage() {
  const [orders, unpaidServed, settings] = await Promise.all([
    getActiveOrders(),
    getUnpaidServedOrders(),
    getSettings(),
  ]);
  return (
    <OrderAktifList
      orders={orders}
      unpaidServed={unpaidServed}
      prepBaseMinutes={settings.prepBaseMinutes}
      prepMinutesPerPortion={settings.prepMinutesPerPortion}
    />
  );
}
