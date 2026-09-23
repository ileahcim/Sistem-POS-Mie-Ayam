import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import { formatFrozenEntryLabel, frozenEntrySignedAmount } from "./types";

export type FrozenExportCustomerRow = {
  nama: string;
  keterangan: string;
  status: string; // "Aktif" / "Nonaktif"
  saldoUtang: number;
};

export type FrozenExportEntryRow = {
  tanggal: string;
  pelanggan: string;
  jenis: string;
  pcs: number | null;
  hargaPerPcs: number | null;
  nominal: number; // signed — summing this column reproduces the balance
  metode: string; // PAYMENT only; "Tidak dicatat" for pre-column rows — see Mi Mentah's export
  catatan: string;
  dicatatOleh: string;
};

// Separate from both the POS export and the Mi Mentah export on purpose —
// this module's money never touches either.
export async function getFrozenExportData(): Promise<{
  customers: FrozenExportCustomerRow[];
  entries: FrozenExportEntryRow[];
}> {
  const customers = await prisma.frozenCustomer.findMany({
    include: {
      entries: {
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const customerRows: FrozenExportCustomerRow[] = [];
  const entryRows: FrozenExportEntryRow[] = [];

  for (const c of customers) {
    const balance = c.entries.reduce((sum, e) => sum + frozenEntrySignedAmount(e), 0);
    customerRows.push({
      nama: c.name,
      keterangan: c.note ?? "",
      status: c.isActive ? "Aktif" : "Nonaktif",
      saldoUtang: balance,
    });

    for (const e of c.entries) {
      entryRows.push({
        tanggal: localDateStr(e.date),
        pelanggan: c.name,
        jenis: formatFrozenEntryLabel(e),
        pcs: e.pcs,
        hargaPerPcs: e.pricePerPcs,
        nominal: frozenEntrySignedAmount(e),
        metode: e.kind === "PAYMENT" ? formatNotePaymentMethod(e.paymentMethod) : "",
        catatan: e.note ?? "",
        dicatatOleh: e.createdBy.name,
      });
    }
  }

  customerRows.sort((a, b) => b.saldoUtang - a.saldoUtang);

  return { customers: customerRows, entries: entryRows };
}
