import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import { formatMieEntryLabel, mieEntrySignedAmount, type MieProductType } from "./types";

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
  // PAYMENT rows only; "" elsewhere. A payment recorded before the column
  // existed exports as "Tidak dicatat", never as a guessed Cash/QRIS.
  metode: string;
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
        // DB enum still has the retired FROZEN value (existing rows, not yet
        // migrated) — formatMieEntryLabel renders it via LEGACY_FROZEN_LABEL.
        jenis: formatMieEntryLabel({ ...e, productType: e.productType as MieProductType | null }),
        kg: e.kg,
        hargaPerKg: e.pricePerKg,
        nominal: mieEntrySignedAmount(e),
        metode: e.kind === "PAYMENT" ? formatNotePaymentMethod(e.paymentMethod) : "",
        catatan: e.note ?? "",
        dicatatOleh: e.createdBy.name,
      });
    }
  }

  customerRows.sort((a, b) => b.saldoUtang - a.saldoUtang);

  return { customers: customerRows, entries: entryRows };
}
