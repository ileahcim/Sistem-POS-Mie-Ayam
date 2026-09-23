import ExcelJS from "exceljs";
import { getMieExportData } from "./get-mie-export-data";

const MONEY_FORMAT = "#,##0";

// Two sheets — Pelanggan (one row per customer, balance summed the same way
// as everywhere else in this module) and Riwayat Transaksi (every ledger
// row, Nominal column signed so summing it in Excel reproduces the balance
// — same "menelusuri baris per baris" philosophy the ledger-not-a-single-
// number rule was built from, see schema.prisma).
export async function buildMieReportWorkbook(): Promise<ExcelJS.Workbook> {
  const { customers, entries } = await getMieExportData();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POS Mi Ayam — Catatan Mi Mentah";
  workbook.created = new Date();

  const customerSheet = workbook.addWorksheet("Pelanggan");
  customerSheet.columns = [
    { header: "Nama", key: "nama", width: 24 },
    { header: "Keterangan", key: "keterangan", width: 28 },
    { header: "Status", key: "status", width: 10 },
    { header: "Saldo Utang", key: "saldoUtang", width: 16, style: { numFmt: MONEY_FORMAT } },
  ];
  customerSheet.addRows(customers);
  customerSheet.getRow(1).font = { bold: true };

  const entrySheet = workbook.addWorksheet("Riwayat Transaksi");
  entrySheet.columns = [
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Pelanggan", key: "pelanggan", width: 24 },
    { header: "Jenis", key: "jenis", width: 16 },
    { header: "Kg", key: "kg", width: 8 },
    { header: "Harga/Kg", key: "hargaPerKg", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Nominal", key: "nominal", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "Metode", key: "metode", width: 14 },
    { header: "Catatan", key: "catatan", width: 24 },
    { header: "Dicatat Oleh", key: "dicatatOleh", width: 16 },
  ];
  entrySheet.addRows(entries);
  entrySheet.getRow(1).font = { bold: true };

  return workbook;
}
