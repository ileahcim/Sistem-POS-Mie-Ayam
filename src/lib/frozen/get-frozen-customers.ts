import { prisma } from "@/lib/prisma";
import { frozenEntrySignedAmount } from "./types";

export type FrozenCustomerRow = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  balance: number; // sum over every ledger entry — never a stored column
};

// Sorted biggest-debt-first by default, same rule as getMieCustomers.
export async function getFrozenCustomers({ includeInactive = false } = {}): Promise<FrozenCustomerRow[]> {
  const customers = await prisma.frozenCustomer.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: { entries: { select: { kind: true, amount: true } } },
  });

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    note: c.note,
    isActive: c.isActive,
    balance: c.entries.reduce((sum, e) => sum + frozenEntrySignedAmount(e), 0),
  }));

  return rows.sort((a, b) => b.balance - a.balance);
}
