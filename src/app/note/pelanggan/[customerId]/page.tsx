import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomerDetail } from "@/lib/mie/get-mie-customer-detail";
import { getPosReceivablesByName } from "@/lib/orders/get-pos-receivables-by-name";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { CustomerDetailScreen } from "@/components/note/customer-detail-screen";

export default async function MieCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await params;
  const [customer, nav] = await Promise.all([
    getMieCustomerDetail(customerId),
    getHeaderNav(),
  ]);
  if (!customer) notFound();
  // Same name also owing for POS menu orders (piutang) — display only.
  const posReceivables = await getPosReceivablesByName(customer.name);

  return <CustomerDetailScreen customer={customer} posReceivables={posReceivables} nav={nav} />;
}
