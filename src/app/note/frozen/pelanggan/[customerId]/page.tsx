import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFrozenCustomerDetail } from "@/lib/frozen/get-frozen-customer-detail";
import { getSettings } from "@/lib/settings/get-settings";
import { getPosReceivablesByName } from "@/lib/orders/get-pos-receivables-by-name";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { FrozenCustomerDetailScreen } from "@/components/note/frozen-customer-detail-screen";

export default async function FrozenCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await params;
  const [customer, settings, nav] = await Promise.all([
    getFrozenCustomerDetail(customerId),
    getSettings(),
    getHeaderNav(),
  ]);
  if (!customer) notFound();
  // Same name also owing for POS menu orders (piutang) — display only.
  const posReceivables = await getPosReceivablesByName(customer.name);

  return (
    <FrozenCustomerDetailScreen
      customer={customer}
      posReceivables={posReceivables}
      printerDriver={settings.printerDriver}
      store={{ storeName: settings.storeName, address: settings.address, phone: settings.phone, printLogo: settings.printLogo }}
      nav={nav}
    />
  );
}
