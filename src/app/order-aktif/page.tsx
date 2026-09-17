import { getActiveOrders, getUnpaidServedOrders } from "@/lib/orders/get-active-orders";
import { getSettings } from "@/lib/settings/get-settings";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { OrderAktifList } from "@/components/order-aktif/order-aktif-list";

export default async function OrderAktifPage() {
  const [orders, unpaidServed, settings, nav] = await Promise.all([
    getActiveOrders(),
    getUnpaidServedOrders(),
    getSettings(),
    getHeaderNav(),
  ]);
  return (
    <OrderAktifList
      orders={orders}
      unpaidServed={unpaidServed}
      prepBaseMinutes={settings.prepBaseMinutes}
      prepMinutesPerPortion={settings.prepMinutesPerPortion}
      nav={nav}
    />
  );
}
