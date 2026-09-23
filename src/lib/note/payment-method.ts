// Metode bayar untuk baris PAYMENT di buku Note — SATU definisi dipakai
// Mi Mentah dan Frozen (mirrors the single NotePaymentMethod enum in
// schema.prisma). Deliberately NOT the POS PaymentMethod: that one carries
// TRANSFER/SPLIT and feeds the cash-drawer reconciliation, and Note money
// never touches the drawer (CLAUDE.md "Catatan Mi Mentah" — dunia terpisah
// dari POS). This column is bookkeeping only.
export type NotePaymentMethod = "CASH" | "QRIS";

export const NOTE_PAYMENT_METHODS: NotePaymentMethod[] = ["CASH", "QRIS"];

export const NOTE_PAYMENT_METHOD_LABEL: Record<NotePaymentMethod, string> = {
  CASH: "Cash",
  QRIS: "QRIS",
};

// Every payment recorded before 23 Sep 2026 has no method, and that is a
// real permanent fact about those rows, not a missing value to fill in with
// a default. One label, one place — so no screen can quietly render a blank
// as "Cash".
export const NOTE_PAYMENT_METHOD_UNKNOWN_LABEL = "Tidak dicatat";

export function formatNotePaymentMethod(method: NotePaymentMethod | null): string {
  return method ? NOTE_PAYMENT_METHOD_LABEL[method] : NOTE_PAYMENT_METHOD_UNKNOWN_LABEL;
}

export function isNotePaymentMethod(value: unknown): value is NotePaymentMethod {
  return value === "CASH" || value === "QRIS";
}

export type NotePaymentMethodEditResult =
  | { ok: true; data: { paymentMethod?: NotePaymentMethod } }
  | { ok: false; error: string };

// The one rule for editing a payment row's method, shared by updateMieEntry
// and updateFrozenEntry so the two books can never drift apart:
//   - not a PAYMENT row        -> never touch the column
//   - caller didn't send it    -> leave as is
//   - a real method            -> store it (this is how an old blank row
//                                 gets filled in later)
//   - null on a blank row      -> stays blank; we refuse to invent a method
//   - null on a recorded row   -> rejected: that destroys a fact instead of
//                                 correcting one. Switch Cash<->QRIS instead.
export function resolveNotePaymentMethodEdit(
  isPaymentRow: boolean,
  current: NotePaymentMethod | null,
  next: NotePaymentMethod | null | undefined,
): NotePaymentMethodEditResult {
  if (!isPaymentRow || next === undefined) return { ok: true, data: {} };
  if (isNotePaymentMethod(next)) return { ok: true, data: { paymentMethod: next } };
  if (next === null) {
    if (current === null) return { ok: true, data: {} };
    return {
      ok: false,
      error: "Metode pembayaran sudah tercatat dan tidak bisa dikosongkan lagi — pilih Cash atau QRIS.",
    };
  }
  return { ok: false, error: "Metode pembayaran tidak valid." };
}
