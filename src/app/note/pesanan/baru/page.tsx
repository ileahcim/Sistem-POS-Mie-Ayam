import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getMiePasarPrice } from "@/lib/mie/get-mie-pasar-price";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NewOrderForm } from "@/components/note/new-order-form";

export default async function NewMieOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await searchParams;
  const [customers, pasarPricePerKg, nav] = await Promise.all([
    getMieCustomers(),
    getMiePasarPrice(),
    getHeaderNav(),
  ]);
  return (
    <NewOrderForm
      customers={customers}
      initialCustomerId={customerId}
      pasarPricePerKg={pasarPricePerKg}
      nav={nav}
    />
  );
}
