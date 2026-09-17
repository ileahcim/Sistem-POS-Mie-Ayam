import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/timezone";
import { formatMieEntryLabel, mieEntrySignedAmount } from "./types";

export type MieExportCustomerRow = {
  nama: string;
  keterangan: string;
  status: string; // "Aktif" / "Nonaktif" — nonaktif customers are exported too, their history still counts
  saldoUtang: number;
};

export type MieExportEntryRow = {
  tanggal: string;
  pelanggan: string;
  jenis: string;
  kg: number | null;
  hargaPerKg: number | null;
  nominal: number; // signed — see mieEntrySignedAmount; summing this column reproduces the balance
  catatan: string;
  dicatatOleh: string;
};

// Separate from the POS export (build-report-workbook.ts) on purpose — this
// module's money never touches Order/Shift, so it gets its own file/route
// rather than a shared workbook with extra sheets.
export async function getMieExportData(): Promise<{
  customers: MieExportCustomerRow[];
  entries: MieExportEntryRow[];
}> {
  const customers = await prisma.mieCustomer.findMany({
    include: {
      entries: {
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const customerRows: MieExportCustomerRow[] = [];
  const entryRows: MieExportEntryRow[] = [];

  for (const c of customers) {
    const balance = c.entries.reduce((sum, e) => sum + mieEntrySignedAmount(e), 0);
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
        jenis: formatMieEntryLabel(e),
        kg: e.kg,
        hargaPerKg: e.pricePerKg,
        nominal: mieEntrySignedAmount(e),
        catatan: e.note ?? "",
        dicatatOleh: e.createdBy.name,
      });
    }
  }

  customerRows.sort((a, b) => b.saldoUtang - a.saldoUtang);

  return { customers: customerRows, entries: entryRows };
}
