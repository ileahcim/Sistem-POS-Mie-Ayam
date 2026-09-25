// Note's two books (Mi Mentah, Frozen) share one page layout: a book
// switcher, then three tabs — Hari Ini (recording, the landing tab), Utang
// (customers & balances), Ringkasan (the report). Everything that differs
// between the books is a URL or a word, kept here so the shared screens
// never spell out a path themselves.

export type NoteBook = "mie" | "frozen";
export type NoteSection = "hari-ini" | "utang" | "ringkasan";

const BASE: Record<NoteBook, string> = { mie: "/note", frozen: "/note/frozen" };

export const NOTE_BOOK = {
  mie: {
    title: "Note",
    orderLabel: "+ Pesanan",
    orderHref: "/note/pesanan/baru",
    paymentHref: "/note/pembayaran/baru",
    newCustomerHref: "/note/pelanggan/baru",
    exportHref: "/note/export",
  },
  frozen: {
    // Same "Note" as Mi Mentah — the book switcher under the header says
    // which book this is; Frozen has no name of its own up here.
    title: "Note",
    // The Frozen book's own word for an order, used on every screen of it.
    orderLabel: "+ Pengambilan",
    orderHref: "/note/frozen/pengambilan/baru",
    paymentHref: "/note/frozen/pembayaran/baru",
    newCustomerHref: "/note/frozen/pelanggan/baru",
    exportHref: "/note/frozen/export",
  },
} as const;

export function noteSectionHref(book: NoteBook, section: NoteSection): string {
  if (section === "hari-ini") return BASE[book];
  return `${BASE[book]}/${section}`;
}

export function noteCustomerHref(book: NoteBook, customerId: string): string {
  return `${BASE[book]}/pelanggan/${customerId}`;
}

// Where a Note screen was opened from (`?dari=`), so Batal/Kembali lead back
// there. Absent = the Hari Ini tab, where the big "+" buttons live.
export type NoteOrigin = "hari-ini" | "utang" | "pelanggan";

export function parseNoteOrigin(value: string | string[] | undefined): NoteOrigin {
  return value === "utang" || value === "pelanggan" ? value : "hari-ini";
}

// Batal on a new order/payment form.
export function noteFormCancelHref(book: NoteBook, origin: NoteOrigin, customerId: string): string {
  if (origin === "pelanggan" && customerId) return noteCustomerHref(book, customerId);
  return noteSectionHref(book, origin === "utang" ? "utang" : "hari-ini");
}

// After saving an order/payment: opened from the customer's page → back to
// it (the new row is in that ledger); from anywhere else → the Hari Ini tab
// with the new row on top, highlighted (`?baru=`), so whoever recorded it
// sees it landed — even a customer who paid up and left the Utang list.
export function noteAfterSaveHref(book: NoteBook, origin: NoteOrigin, customerId: string, entryId: string): string {
  if (origin === "pelanggan") return noteCustomerHref(book, customerId);
  return `${noteSectionHref(book, "hari-ini")}?baru=${encodeURIComponent(entryId)}`;
}
