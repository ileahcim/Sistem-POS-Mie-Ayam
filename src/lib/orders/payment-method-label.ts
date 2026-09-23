import { formatRupiah } from "@/lib/printing/format";

// Shared everywhere a raw PaymentMethod used to be printed as-is (Riwayat
// Pesanan, detail order, export Excel) — see receipt-layout.ts's own
// PAYMENT_LABEL for the struk's copy (kept separate on purpose, struk
// wording is frozen by CLAUDE.md's paper-parity rules).
export const PAYMENT_METHOD_LABEL: Record<"CASH" | "QRIS" | "TRANSFER" | "SPLIT", string> = {
  CASH: "Cash",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
  SPLIT: "Cash + QRIS",
};

// A SPLIT order's label expands to show the breakdown inline — everywhere
// else, this is just the plain label. Returns null only when there's no
// payment method at all (order not yet paid).
// Offered at the till (CASH/QRIS/SPLIT only — TRANSFER isn't a method a
// cashier can pick today, so there's nothing to correct it to or from).
// Neutral file, not the "use server" actions.ts — that file may only export
// async functions (CLAUDE.md "File "use server" CUMA boleh...").
export const CHANGEABLE_PAYMENT_METHODS = ["CASH", "QRIS", "SPLIT"] as const;
export type ChangeablePaymentMethod = (typeof CHANGEABLE_PAYMENT_METHODS)[number];

export function formatPaymentMethodDetail(
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "SPLIT" | null,
  splitCashAmount: number | null,
  splitQrisAmount: number | null,
): string | null {
  if (!paymentMethod) return null;
  if (paymentMethod === "SPLIT" && splitCashAmount != null && splitQrisAmount != null) {
    return `${PAYMENT_METHOD_LABEL.SPLIT} (Tunai ${formatRupiah(splitCashAmount)} · QRIS ${formatRupiah(splitQrisAmount)})`;
  }
  return PAYMENT_METHOD_LABEL[paymentMethod];
}
