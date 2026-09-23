import ExcelJS from "exceljs";
import { getFrozenExportData } from "./get-frozen-export-data";

const MONEY_FORMAT = "#,##0";

// Two sheets, mirrors build-mie-report-workbook.ts exactly — Nominal column
// signed so summing it in Excel reproduces the balance.
export async function buildFrozenReportWorkbook(): Promise<ExcelJS.Workbook> {
  const { customers, entries } = await getFrozenExportData();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POS Mi Ayam — Buku Frozen";
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
    { header: "Pcs", key: "pcs", width: 8 },
    { header: "Harga/Pcs", key: "hargaPerPcs", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Nominal", key: "nominal", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "Metode", key: "metode", width: 14 },
    { header: "Catatan", key: "catatan", width: 24 },
    { header: "Dicatat Oleh", key: "dicatatOleh", width: 16 },
  ];
  entrySheet.addRows(entries);
  entrySheet.getRow(1).font = { bold: true };

  return workbook;
}
