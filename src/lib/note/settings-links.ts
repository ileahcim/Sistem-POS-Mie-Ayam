// Where Note's price/cost settings live since 2 Nov 2026 (the old
// /note/produk page redirects): sale prices in Manajemen Menu → "Mi Mentah",
// modal per kg in Isi HPP → "Mi Mentah". `?dari=` makes Kembali on those
// pages return to the Note screen that linked there.
export type NoteSettingsOrigin = "note" | "frozen" | "ringkasan" | "frozen-ringkasan";

const BACK: Record<NoteSettingsOrigin, string> = {
  note: "/note/utang",
  frozen: "/note/frozen/utang",
  ringkasan: "/note/ringkasan",
  "frozen-ringkasan": "/note/frozen/ringkasan",
};

export function notePriceSettingsHref(from: NoteSettingsOrigin): string {
  return `/admin/menu?dari=${from}#mi-mentah`;
}

export function noteCostSettingsHref(from: NoteSettingsOrigin): string {
  return `/admin/hpp?dari=${from}#mi-mentah`;
}

// Kembali of /admin/menu and /admin/hpp: back to the Note screen, else Pengaturan.
export function adminBackHref(dari: string | undefined): string {
  return (dari && BACK[dari as NoteSettingsOrigin]) || "/admin/settings";
}
