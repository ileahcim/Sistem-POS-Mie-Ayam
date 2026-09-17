import { prisma } from "@/lib/prisma";
import { mieEntrySignedAmount, type MieLedgerEntryDTO } from "./types";

export type MieCustomerDetail = {
  id: string;
  name: string;
  note: string | null;
  balance: number;
  entries: (MieLedgerEntryDTO & { runningBalance: number })[]; // oldest first, balance accumulates down the page
};

export async function getMieCustomerDetail(customerId: string): Promise<MieCustomerDetail | null> {
  const customer = await prisma.mieCustomer.findUnique({
    where: { id: customerId },
    include: {
      entries: {
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!customer) return null;

  let running = 0;
  const entries = customer.entries.map((e) => {
    running += mieEntrySignedAmount(e);
    return {
      id: e.id,
      kind: e.kind,
      productType: e.productType,
      customLabel: e.customLabel,
      kg: e.kg,
      pricePerKg: e.pricePerKg,
      amount: e.amount,
      date: e.date.toISOString(),
      note: e.note,
      createdByName: e.createdBy.name,
      runningBalance: running,
    };
  });

  return {
    id: customer.id,
    name: customer.name,
    note: customer.note,
    balance: running,
    entries,
  };
}
