import { prisma } from "@/lib/prisma";
import { frozenEntrySignedAmount, type FrozenLedgerEntryDTO } from "./types";

export type FrozenCustomerDetail = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  balance: number;
  entries: (FrozenLedgerEntryDTO & { runningBalance: number })[]; // oldest first
};

export async function getFrozenCustomerDetail(customerId: string): Promise<FrozenCustomerDetail | null> {
  const customer = await prisma.frozenCustomer.findUnique({
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
    running += frozenEntrySignedAmount(e);
    return {
      id: e.id,
      kind: e.kind,
      pcs: e.pcs,
      pricePerPcs: e.pricePerPcs,
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
    isActive: customer.isActive,
    balance: running,
    entries,
  };
}
