import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomerDetail } from "@/lib/mie/get-mie-customer-detail";
import { getPosReceivablesByName } from "@/lib/orders/get-pos-receivables-by-name";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { CustomerDetailScreen } from "@/components/note/customer-detail-screen";
import { noteSectionHref } from "@/lib/note/books";

export default async function MieCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ dari?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await params;
  // Opened from a Hari Ini row → Kembali returns there; otherwise to Utang,
  // where the customer list lives.
  const { dari } = await searchParams;
  const backHref = noteSectionHref("mie", dari === "hari-ini" ? "hari-ini" : "utang");
  const [customer, nav, productDefaults] = await Promise.all([
    getMieCustomerDetail(customerId),
    getHeaderNav(),
    getMieProductDefaults(),
  ]);
  if (!customer) notFound();
  // Same name also owing for POS menu orders (piutang) — display only.
  const posReceivables = await getPosReceivablesByName(customer.name);

  return (
    <CustomerDetailScreen
      customer={customer}
      posReceivables={posReceivables}
      productDefaults={productDefaults}
      backHref={backHref}
      nav={nav}
    />
  );
}
