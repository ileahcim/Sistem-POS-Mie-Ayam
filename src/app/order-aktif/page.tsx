import { getActiveOrders, getUnpaidServedOrders } from "@/lib/orders/get-active-orders";
import { getSettings } from "@/lib/settings/get-settings";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { OrderAktifList } from "@/components/order-aktif/order-aktif-list";

export default async function OrderAktifPage() {
  const [orders, unpaidServed, settings, user] = await Promise.all([
    getActiveOrders(),
    getUnpaidServedOrders(),
    getSettings(),
    getCurrentUser(),
  ]);
  return (
    <OrderAktifList
      orders={orders}
      unpaidServed={unpaidServed}
      prepBaseMinutes={settings.prepBaseMinutes}
      prepMinutesPerPortion={settings.prepMinutesPerPortion}
      isOwner={user?.role === "OWNER"}
    />
  );
}
