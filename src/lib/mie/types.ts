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
export type MieLedgerKind = "ORDER" | "PAYMENT" | "OPENING_BALANCE" | "CORRECTION_ADD" | "CORRECTION_SUBTRACT" | "RETURN";

// "Retur" (26 Sep 2026): mi titip-jual that came back unsold. Same item
// fields as ORDER (jenis, kg, harga/kg), amount = kg × harga/kg, and it
// LOWERS the debt — it cancels that part of the sale. Ringkasan counts omzet,
// kg and margin net of it; it is never a loss (the mi is used at the warung).
export function mieEntryHasItems(kind: MieLedgerKind): boolean {
  return kind === "ORDER" || kind === "RETURN";
}


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

// Where the new-order form's suggested Rp/kg came from (getMieAutofillPrice):
// this customer's "harga khusus", their last order, or the general default.
export type MiePriceSource = "khusus" | "terakhir" | "umum";
export type MieAutofillPrice = { price: number; source: MiePriceSource };

// Tap-first presets for recording while standing in the production area
// (CLAUDE.md "Catatan Mi Mentah"). "Mie Pasar" is the daily market order:
// always Mi Keriting, at the owner-editable MieSetting.pasarPricePerKg (set
// from /note/produk — market prices change too often for a code constant),
// deliberately not the per-customer autofill.
export const MIE_PASAR_PRODUCT_TYPE = "MIE_KERITING" as const;
export const MIE_PASAR_LABEL = "Mi Pasar";

// Which "Modal per kg" an ORDER row's margin uses (25 Sep 2026). Reguler
// per jenis (MieProductDefault.costPerKg), plus MIE_PASAR for rows tapped as
// "Mi Pasar" — a cheaper recipe (less egg), not just a cheaper sale price.
// Mi Keriting only: Lurus/Pangsit have no pasar variant. CUSTOM has no
// cost at all (a one-off request), so it maps to null.
export type MieCostKey = Exclude<MieProductType, "CUSTOM"> | "MIE_PASAR";
export type MieCosts = Record<MieCostKey, number | null>;

export const MIE_COST_ROWS: { key: MieCostKey; label: string }[] = [
  { key: "MIE_KERITING", label: "Mi Keriting — Modal per kg (Reguler)" },
  { key: "MIE_PASAR", label: "Mi Keriting — Modal per kg (Mi Pasar)" },
  { key: "MIE_LURUS", label: "Mi Lurus — Modal per kg (Reguler)" },
  { key: "PANGSIT", label: "Pangsit — Modal per kg (Reguler)" },
];

// Short name of each cost key, for warnings and the per-jenis table.
export const MIE_COST_KEY_LABEL: Record<MieCostKey, string> = {
  MIE_KERITING: "Mi Keriting",
  MIE_PASAR: MIE_PASAR_LABEL,
  MIE_LURUS: "Mi Lurus",
  PANGSIT: "Pangsit",
};

export function mieCostKeyOf(entry: Pick<MieLedgerEntryDTO, "productType" | "isPasar">): MieCostKey | null {
  if (entry.productType === "MIE_KERITING") return entry.isPasar ? "MIE_PASAR" : "MIE_KERITING";
  if (entry.productType === "MIE_LURUS" || entry.productType === "PANGSIT") return entry.productType;
  return null; // CUSTOM, or a legacy FROZEN row
}

// Margin of one ORDER row = sale amount (kg × the price snapshotted on the
// row) − modal per kg × kg. null when the row has no modal to use (not
// filled in yet, or CUSTOM) — the caller leaves it OUT of the margin total
// instead of treating the cost as 0, which would overstate the profit.
export function mieOrderMargin(
  entry: Pick<MieLedgerEntryDTO, "productType" | "isPasar" | "kg" | "amount">,
  costs: MieCosts,
): number | null {
  const key = mieCostKeyOf(entry);
  const cost = key ? costs[key] : null;
  if (cost == null || entry.kg == null) return null;
  return entry.amount - Math.round(cost * entry.kg);
}

export const MIE_KG_PRESETS = [5, 10, 15, 20];
export const MIE_PAYMENT_PRESETS = [50000, 100000, 200000, 500000];

export type MieLedgerEntryDTO = {
  id: string;
  kind: MieLedgerKind;
  // PAYMENT rows only; null on every other kind AND on payments recorded
  // before the column existed — rendered as "Tidak dicatat", never guessed.
  paymentMethod: NotePaymentMethod | null;
  productType: MieProductType | null;
  isPasar: boolean; // ORDER only — see mieCostKeyOf
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
export function formatMieEntryLabel(
  entry: Pick<MieLedgerEntryDTO, "kind" | "productType" | "customLabel"> & { isPasar?: boolean },
): string {
  if (entry.kind === "PAYMENT") return "Pembayaran";
  if (entry.kind === "OPENING_BALANCE") return "Saldo awal / utang lama";
  if (entry.kind === "CORRECTION_ADD") return "Koreksi (+)";
  if (entry.kind === "CORRECTION_SUBTRACT") return "Koreksi (−)";
  if (entry.kind === "RETURN") return `Retur ${formatMieJenisLabel(entry)}`;
  return formatMieJenisLabel(entry);
}

// The jenis name alone ("Mi Keriting", "Mi Pasar", a custom name) of an
// ORDER/RETURN row.
export function formatMieJenisLabel(
  entry: Pick<MieLedgerEntryDTO, "productType" | "customLabel"> & { isPasar?: boolean },
): string {
  if (entry.productType === "CUSTOM") return entry.customLabel || "Custom";
  // A live row can still carry the DB's retired "FROZEN" value (existing
  // production data, not yet migrated — see the type's doc comment) even
  // though MieProductType can no longer type-check as that value.
  if ((entry.productType as string) === "FROZEN") return LEGACY_FROZEN_LABEL;
  if (entry.productType === "MIE_KERITING" && entry.isPasar) return MIE_PASAR_LABEL;
  return entry.productType ? MIE_PRODUCT_LABEL[entry.productType] : "—";
}

// ORDER, OPENING_BALANCE and CORRECTION_ADD add to what the customer owes;
// PAYMENT, CORRECTION_SUBTRACT and RETURN reduce it. `amount` is always stored/returned positive — this is the one place
// the sign is decided, so balance math can never disagree between the
// summary card, the ledger table, and the Excel export.
export function mieEntrySignedAmount(entry: Pick<MieLedgerEntryDTO, "kind" | "amount">): number {
  return mieEntryReducesDebt(entry.kind) ? -entry.amount : entry.amount;
}

export function mieEntryReducesDebt(kind: MieLedgerKind): boolean {
  return kind === "PAYMENT" || kind === "CORRECTION_SUBTRACT" || kind === "RETURN";
}
