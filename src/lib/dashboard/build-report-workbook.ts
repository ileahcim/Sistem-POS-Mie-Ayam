import ExcelJS from "exceljs";
import { getAllPaidTransactions, getAllClosedShifts, type ExportShiftRow } from "./get-export-data";

type DailyRecap = {
  tanggal: string;
  jumlahShift: number;
  modalAwal: number;
  penjualanCash: number;
  penjualanNonCash: number;
  pengeluaran: number;
  dpHangus: number;
  omzetTotal: number;
};

// Derived by summing the frozen per-shift numbers per calendar day (the
// shift's open date) — not recomputed from Order, same rule as everywhere
// else in the dashboard.
function buildDailyRecap(shifts: ExportShiftRow[]): DailyRecap[] {
  const byDay = new Map<string, DailyRecap>();
  for (const s of shifts) {
    const existing = byDay.get(s.tanggalBuka);
    if (existing) {
      existing.jumlahShift += 1;
      existing.modalAwal += s.openingCash;
      existing.penjualanCash += s.cashSales;
      existing.penjualanNonCash += s.nonCashSales;
      existing.pengeluaran += s.expenseTotal;
      existing.dpHangus += s.forfeitedDeposits;
      existing.omzetTotal += s.cashSales + s.nonCashSales + s.forfeitedDeposits;
    } else {
      byDay.set(s.tanggalBuka, {
        tanggal: s.tanggalBuka,
        jumlahShift: 1,
        modalAwal: s.openingCash,
        penjualanCash: s.cashSales,
        penjualanNonCash: s.nonCashSales,
        pengeluaran: s.expenseTotal,
        dpHangus: s.forfeitedDeposits,
        omzetTotal: s.cashSales + s.nonCashSales + s.forfeitedDeposits,
      });
    }
  }
  return [...byDay.values()].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1));
}

const MONEY_FORMAT = "#,##0";

// Three sheets — transaksi (one row per PAID order), rekap harian (daily
// rollup from the frozen shift ledger), riwayat shift (one row per closed
// shift). Every money column is a real numeric cell (not text), so it can
// be summed directly in Excel — see CLAUDE.md "Dashboard".
export async function buildReportWorkbook(): Promise<ExcelJS.Workbook> {
  const [transactions, shifts] = await Promise.all([getAllPaidTransactions(), getAllClosedShifts()]);
  const dailyRecap = buildDailyRecap(shifts);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POS Mi Ayam";
  workbook.created = new Date();

  const txSheet = workbook.addWorksheet("Transaksi");
  txSheet.columns = [
    { header: "No. Order", key: "orderNumber", width: 10 },
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Jam", key: "jam", width: 8 },
    { header: "Channel", key: "channel", width: 10 },
    { header: "Meja", key: "meja", width: 8 },
    { header: "Nama Pelanggan", key: "namaPelanggan", width: 20 },
    { header: "Metode Bayar", key: "metodeBayar", width: 12 },
    { header: "Split - Cash", key: "splitCashAmount", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Split - QRIS", key: "splitQrisAmount", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Subtotal", key: "subtotal", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Ongkir", key: "ongkir", width: 10, style: { numFmt: MONEY_FORMAT } },
    { header: "Total", key: "total", width: 12, style: { numFmt: MONEY_FORMAT } },
  ];
  txSheet.addRows(transactions);
  txSheet.getRow(1).font = { bold: true };

  const recapSheet = workbook.addWorksheet("Rekap Harian");
  recapSheet.columns = [
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Jumlah Shift", key: "jumlahShift", width: 12 },
    { header: "Modal Awal", key: "modalAwal", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "Penjualan Cash", key: "penjualanCash", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "Penjualan Non-Cash", key: "penjualanNonCash", width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: "Pengeluaran", key: "pengeluaran", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "DP Hangus", key: "dpHangus", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Omzet Total", key: "omzetTotal", width: 14, style: { numFmt: MONEY_FORMAT } },
  ];
  recapSheet.addRows(dailyRecap);
  recapSheet.getRow(1).font = { bold: true };

  const shiftSheet = workbook.addWorksheet("Riwayat Shift");
  shiftSheet.columns = [
    { header: "Tanggal Buka", key: "tanggalBuka", width: 12 },
    { header: "Jam Buka", key: "jamBuka", width: 10 },
    { header: "Jam Tutup", key: "jamTutup", width: 10 },
    { header: "Kasir", key: "kasir", width: 16 },
    // Same order and wording as the Tutup Shift result screen.
    { header: "Modal Awal Laci", key: "openingCash", width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: "Penjualan Cash", key: "cashSales", width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: "Penjualan Non-Cash", key: "nonCashSales", width: 19, style: { numFmt: MONEY_FORMAT } },
    { header: "DP Dipakai", key: "depositsAppliedCash", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Terima DP (Tunai)", key: "depositsReceivedCash", width: 17, style: { numFmt: MONEY_FORMAT } },
    { header: "DP Kembali (Tunai)", key: "depositRefundsCash", width: 18, style: { numFmt: MONEY_FORMAT } },
    { header: "DP Hangus", key: "forfeitedDeposits", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Total Pengeluaran", key: "expenseTotal", width: 18, style: { numFmt: MONEY_FORMAT } },
    { header: "Uang Seharusnya", key: "expectedCash", width: 17, style: { numFmt: MONEY_FORMAT } },
    { header: "Uang Fisik Dihitung", key: "countedCash", width: 20, style: { numFmt: MONEY_FORMAT } },
    { header: "Selisih", key: "difference", width: 12, style: { numFmt: MONEY_FORMAT } },
  ];
  shiftSheet.addRows(shifts);
  shiftSheet.getRow(1).font = { bold: true };

  return workbook;
}
