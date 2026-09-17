// Catatan Mi Mentah — shared shapes, mirrored from the Prisma enums as
// plain string unions (same convention as the rest of this codebase, e.g.
// Order's channel/status types — never importing the generated Prisma enum
// directly into a DTO type).
export type MieProductType = "MIE_KERITING" | "MIE_LURUS" | "PANGSIT" | "CUSTOM";
export type MieLedgerKind = "ORDER" | "PAYMENT" | "OPENING_BALANCE";

export const MIE_PRODUCT_LABEL: Record<Exclude<MieProductType, "CUSTOM">, string> = {
  MIE_KERITING: "Mi Keriting",
  MIE_LURUS: "Mi Lurus",
  PANGSIT: "Pangsit",
};

export const MIE_FIXED_PRODUCT_TYPES: Exclude<MieProductType, "CUSTOM">[] = [
  "MIE_KERITING",
  "MIE_LURUS",
  "PANGSIT",
];

export type MieLedgerEntryDTO = {
  id: string;
  kind: MieLedgerKind;
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
  if (entry.kind === "OPENING_BALANCE") return "Saldo awal";
  if (entry.productType === "CUSTOM") return entry.customLabel || "Custom";
  return entry.productType ? MIE_PRODUCT_LABEL[entry.productType] : "—";
}

// ORDER and OPENING_BALANCE add to what the customer owes; PAYMENT reduces
// it. `amount` is always stored/returned positive — this is the one place
// the sign is decided, so balance math can never disagree between the
// summary card, the ledger table, and the Excel export.
export function mieEntrySignedAmount(entry: Pick<MieLedgerEntryDTO, "kind" | "amount">): number {
  return entry.kind === "PAYMENT" ? -entry.amount : entry.amount;
}
