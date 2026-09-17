import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomerDetail } from "@/lib/mie/get-mie-customer-detail";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { CustomerDetailScreen } from "@/components/note/customer-detail-screen";

export default async function MieCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await params;
  const [customer, orderAktifIndicator] = await Promise.all([
    getMieCustomerDetail(customerId),
    getOrderAktifIndicator(),
  ]);
  if (!customer) notFound();

  return <CustomerDetailScreen customer={customer} orderAktifIndicator={orderAktifIndicator} />;
}
