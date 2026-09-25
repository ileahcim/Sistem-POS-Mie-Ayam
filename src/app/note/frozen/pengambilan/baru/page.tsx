import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFrozenCustomers } from "@/lib/frozen/get-frozen-customers";
import { getSettings } from "@/lib/settings/get-settings";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NewFrozenOrderForm } from "@/components/note/new-frozen-order-form";
import { parseNoteOrigin } from "@/lib/note/books";

export default async function NewFrozenOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; dari?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId, dari } = await searchParams;
  const [customers, settings, nav] = await Promise.all([getFrozenCustomers(), getSettings(), getHeaderNav()]);
  return (
    <NewFrozenOrderForm
      customers={customers}
      initialCustomerId={customerId}
      origin={parseNoteOrigin(dari)}
      printerDriver={settings.printerDriver}
      store={{ storeName: settings.storeName, address: settings.address, phone: settings.phone, printLogo: settings.printLogo }}
      nav={nav}
    />
  );
}
