// Split payment ("Cash + QRIS") validation — one function, read by the
// payment screen (so the cashier sees the problem before tapping Bayar) and
// by payOrder (the actual authority — CLAUDE.md "Total selalu dihitung ulang
// di server saat pembayaran, tidak pernah percaya angka dari client").
export function validateSplitCashAmount(cashAmount: number, amountDue: number): string | null {
  if (!Number.isFinite(cashAmount)) return "Jumlah tunai tidak valid.";
  if (cashAmount <= 0) return "Jumlah tunai harus lebih dari 0 — kalau semuanya QRIS, pilih QRIS saja.";
  if (cashAmount >= amountDue) return "Jumlah tunai sudah menutup semuanya — pilih Cash saja.";
  return null;
}
