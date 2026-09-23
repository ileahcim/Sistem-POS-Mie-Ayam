// Buku Frozen — shared shapes, mirrored from the FrozenLedgerKind Prisma
// enum as a plain string union (same convention as src/lib/mie/types.ts).
// Mie Frozen is consigned to a reseller (e.g. "KMK Frozen") who resells it
// and settles with the owner directly in cash — that money never touches
// the warung's cash drawer, and this ledger never touches Shift/Order/
// Expense/omzet or the Mi Mentah ledger. Priced per PIECE (pcs), not kg,
// and there is no "jenis" concept at all: every pickup is the same product.
import type { NotePaymentMethod } from "@/lib/note/payment-method";

export type FrozenLedgerKind = "ORDER" | "PAYMENT" | "OPENING_BALANCE" | "CORRECTION_ADD" | "CORRECTION_SUBTRACT";

// Kinds that carry a plain amount (no pcs/price) and are added from the
// customer page's "Koreksi Saldo" sheet.
export type FrozenAdjustmentKind = "OPENING_BALANCE" | "CORRECTION_ADD" | "CORRECTION_SUBTRACT";

export const FROZEN_ADJUSTMENT_LABEL: Record<FrozenAdjustmentKind, string> = {
  OPENING_BALANCE: "Utang lama",
  CORRECTION_ADD: "Koreksi (+)",
  CORRECTION_SUBTRACT: "Koreksi (−)",
};

// Tap-first presets — bulk pickup sizes, recorded while standing at pickup
// (mirrors MIE_KG_PRESETS' role, not owner-dictated, just sane defaults).
export const FROZEN_PCS_PRESETS = [12, 24, 48, 96];
export const FROZEN_PAYMENT_PRESETS = [50000, 100000, 200000, 500000];

export type FrozenLedgerEntryDTO = {
  id: string;
  kind: FrozenLedgerKind;
  // PAYMENT rows only; null on other kinds and on pre-23-Sep-2026 payments
  // — rendered as "Tidak dicatat", never guessed. Same rule as Mi Mentah.
  paymentMethod: NotePaymentMethod | null;
  pcs: number | null;
  pricePerPcs: number | null;
  amount: number;
  date: string;
  note: string | null;
  createdByName: string;
};

// The one place "what does this row show as its item name" is decided —
// used by both the customer detail ledger and the Excel export.
export function formatFrozenEntryLabel(entry: Pick<FrozenLedgerEntryDTO, "kind">): string {
  if (entry.kind === "PAYMENT") return "Pembayaran";
  if (entry.kind === "ORDER") return "Pengambilan";
  if (entry.kind === "OPENING_BALANCE") return "Saldo awal / utang lama";
  if (entry.kind === "CORRECTION_ADD") return "Koreksi (+)";
  return "Koreksi (−)";
}

// ORDER, OPENING_BALANCE and CORRECTION_ADD add to what the customer owes;
// PAYMENT and CORRECTION_SUBTRACT reduce it. `amount` is always
// stored/returned positive — this is the one place the sign is decided
// (mirrors mieEntrySignedAmount).
export function frozenEntrySignedAmount(entry: Pick<FrozenLedgerEntryDTO, "kind" | "amount">): number {
  return frozenEntryReducesDebt(entry.kind) ? -entry.amount : entry.amount;
}

export function frozenEntryReducesDebt(kind: FrozenLedgerKind): boolean {
  return kind === "PAYMENT" || kind === "CORRECTION_SUBTRACT";
}
