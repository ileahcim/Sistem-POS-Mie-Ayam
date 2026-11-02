import { redirect } from "next/navigation";
import { notePriceSettingsHref } from "@/lib/note/settings-links";

// The old "Harga Produk" page (2 Nov 2026, owner's call): prices were editable
// in three places, so it was removed. Sale prices now live in Manajemen Menu →
// "Mi Mentah", modal per kg in Isi HPP → "Mi Mentah". Old bookmarks land on
// the new place; Kembali there returns to the Note book it came from.
export default async function OldProductDefaultsPage({ searchParams }: { searchParams: Promise<{ dari?: string }> }) {
  const { dari } = await searchParams;
  redirect(notePriceSettingsHref(dari === "frozen" ? "frozen" : dari === "ringkasan" ? "ringkasan" : "note"));
}
