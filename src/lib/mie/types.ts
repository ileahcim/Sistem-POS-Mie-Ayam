// Catatan Mi Mentah — shared shapes, mirrored from the Prisma enums as
// plain string unions (same convention as the rest of this codebase, e.g.
// Order's channel/status types — never importing the generated Prisma enum
// directly into a DTO type).
//
// FROZEN was here for one night (22 Sep 2026) as a "jenis mi" — reverted:
// Mie Frozen is consigned to a reseller and settled entirely outside this
// buku (see FrozenCustomer/FrozenLedgerEntry, its own buku), priced per pcs
// not kg. The DB enum still has the FROZEN value (Postgres can't cleanly
// drop one) and a handful of real ledger rows/the "KMK Frozen" customer
// still carry it until the owner approves moving that data — see
// LEGACY_FROZEN_LABEL below for how those old rows still render without
// this type ever being able to produce a new one.
import type { NotePaymentMethod } from "@/lib/note/payment-method";

export type MieProductType = "MIE_KERITING" | "MIE_LURUS" | "PANGSIT" | "CUSTOM";
export type MieLedgerKind = "ORDER" | "PAYMENT" | "OPENING_BALANCE" | "CORRECTION_ADD" | "CORRECTION_SUBTRACT";

// Kinds that carry a plain amount (no kg/price) and are added from the
// customer page's "Koreksi Saldo" sheet.
export type MieAdjustmentKind = "OPENING_BALANCE" | "CORRECTION_ADD" | "CORRECTION_SUBTRACT";

export const MIE_ADJUSTMENT_LABEL: Record<MieAdjustmentKind, string> = {
  OPENING_BALANCE: "Utang lama",
  CORRECTION_ADD: "Koreksi (+)",
  CORRECTION_SUBTRACT: "Koreksi (−)",
};

export const MIE_PRODUCT_LABEL: Record<Exclude<MieProductType, "CUSTOM">, string> = {
  MIE_KERITING: "Mi Keriting",
  MIE_LURUS: "Mi Lurus",
  PANGSIT: "Pangsit",
};

// Label for a legacy ledger row still tagged with the DB's retired FROZEN
// value (a real "KMK Frozen" customer + rows exist in production from the
// one-night experiment, 22 Sep 2026) — MieProductType no longer includes
// "FROZEN" so nothing can write a new one, but existing rows must still
// render as something readable instead of blank/undefined until the owner
// approves moving them into the Frozen buku. See formatMieEntryLabel below.
export const LEGACY_FROZEN_LABEL = "Frozen (akan dipindah)";

// Used by the order form's jenis buttons AND /note/produk's default-price
// rows, and by the Ringkasan's headline omzet/kg + "Per jenis mi" table —
// one list again now that Frozen has its own separate buku.
export const MIE_FIXED_PRODUCT_TYPES: Exclude<MieProductType, "CUSTOM">[] = ["MIE_KERITING", "MIE_LURUS", "PANGSIT"];

// Tap-first presets for recording while standing in the production area
// (CLAUDE.md "Catatan Mi Mentah"). "Mie Pasar" is the daily market order:
// always Mi Keriting, at the owner-editable MieSetting.pasarPricePerKg (set
// from /note/produk — market prices change too often for a code constant),
// deliberately not the per-customer autofill.
export const MIE_PASAR_PRODUCT_TYPE = "MIE_KERITING" as const;
export const MIE_KG_PRESETS = [5, 10, 15, 20];
export const MIE_PAYMENT_PRESETS = [50000, 100000, 200000, 500000];

export type MieLedgerEntryDTO = {
  id: string;
  kind: MieLedgerKind;
  // PAYMENT rows only; null on every other kind AND on payments recorded
  // before the column existed — rendered as "Tidak dicatat", never guessed.
  paymentMethod: NotePaymentMethod | null;
  productType: MieProductType | null;
  customLabel: string | null;
  kg: number | null;
  pricePerKg: number | null;
  amount: number;
  date: string;
  note: string | null;
  createdByName: string;
};

// The one place "what does this row show as its item name" is decided —
// used by both the customer detail ledger and the Excel export so they can
// never read differently.
export function formatMieEntryLabel(entry: Pick<MieLedgerEntryDTO, "kind" | "productType" | "customLabel">): string {
  if (entry.kind === "PAYMENT") return "Pembayaran";
  if (entry.kind === "OPENING_BALANCE") return "Saldo awal / utang lama";
  if (entry.kind === "CORRECTION_ADD") return "Koreksi (+)";
  if (entry.kind === "CORRECTION_SUBTRACT") return "Koreksi (−)";
  if (entry.productType === "CUSTOM") return entry.customLabel || "Custom";
  // A live row can still carry the DB's retired "FROZEN" value (existing
  // production data, not yet migrated — see the type's doc comment) even
  // though MieProductType can no longer type-check as that value.
  if ((entry.productType as string) === "FROZEN") return LEGACY_FROZEN_LABEL;
  return entry.productType ? MIE_PRODUCT_LABEL[entry.productType] : "—";
}

// ORDER, OPENING_BALANCE and CORRECTION_ADD add to what the customer owes;
// PAYMENT and CORRECTION_SUBTRACT reduce it. `amount` is always stored/returned positive — this is the one place
// the sign is decided, so balance math can never disagree between the
// summary card, the ledger table, and the Excel export.
export function mieEntrySignedAmount(entry: Pick<MieLedgerEntryDTO, "kind" | "amount">): number {
  return mieEntryReducesDebt(entry.kind) ? -entry.amount : entry.amount;
}

export function mieEntryReducesDebt(kind: MieLedgerKind): boolean {
  return kind === "PAYMENT" || kind === "CORRECTION_SUBTRACT";
}
