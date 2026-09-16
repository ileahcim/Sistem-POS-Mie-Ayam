import { getOrderHistory, clampHistoryFilterForRole } from "@/lib/orders/get-order-history";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { localDateStr } from "@/lib/timezone";
import { RiwayatPesananScreen } from "@/components/riwayat-pesanan/riwayat-pesanan-screen";

export default async function RiwayatPesananPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const isOwner = user?.role === "OWNER";
  const today = localDateStr(new Date());

  // CASHIER never gets a query reaching past today, no matter what the URL
  // says — see clampHistoryFilterForRole in get-order-history.ts.
  const filter = clampHistoryFilterForRole(
    { dateFrom: params.from || today, dateTo: params.to || today, search: params.q ?? "" },
    isOwner,
  );

  const [orders, orderAktifIndicator] = await Promise.all([getOrderHistory(filter), getOrderAktifIndicator()]);

  return (
    <RiwayatPesananScreen orders={orders} filter={filter} isOwner={isOwner} orderAktifIndicator={orderAktifIndicator} />
  );
}
