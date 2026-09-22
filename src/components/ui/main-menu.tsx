"use client";

import { useState } from "react";
import { HeaderMenuButton } from "./header-menu-button";
import { ListRow } from "./list-row";
import { SheetItem } from "./sheet-motion";
import { SignOutButton } from "@/components/auth/sign-out-button";

// The single shared navigation menu for the app — every destination lives
// here now instead of being scattered across per-screen header buttons.
// Rendered identically on every screen (always the top-left header button)
// so there is only one nav to keep in sync as destinations are added. "Order Aktif" graduated out of this list
// into its own always-visible header button (OrderAktifButton) since it
// needs to carry the late-order indicator — see CLAUDE.md-worthy brief.
// "Tutup Shift" is visually set apart (warning tint) since it's the one
// deliberate, once-a-day action mixed in among the read/navigate-only items.
// Set-up-once screens (Isi HPP, Foto Produk) deliberately do NOT live here
// — they sit inside Pengaturan, so this list stays the short list of places
// actually visited during a shift.
type MenuEntry = { href: string; label: string; ownerOnly?: boolean; warning?: boolean };

const MENU_ENTRIES: MenuEntry[] = [
  { href: "/kasir", label: "Kasir" },
  { href: "/order-aktif", label: "Order Aktif" },
  { href: "/riwayat-pesanan", label: "Riwayat Pesanan" },
  { href: "/dashboard", label: "Dashboard", ownerOnly: true },
  { href: "/note", label: "Note (Mi Mentah)", ownerOnly: true },
  { href: "/admin/settings", label: "Pengaturan", ownerOnly: true },
  { href: "/pesanan-terjadwal", label: "Pesanan Terjadwal" },
  { href: "/piutang", label: "Piutang" },
  { href: "/shift/pengeluaran", label: "Pengeluaran" },
  { href: "/shift/tutup", label: "Tutup Shift", warning: true },
];

export function MainMenu({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const entries = MENU_ENTRIES.filter((e) => isOwner || !e.ownerOnly);
  return (
    <HeaderMenuButton open={open} onOpen={() => setOpen(true)} onClose={close}>
      {entries.map((entry, i) => (
        <SheetItem key={entry.href} index={i} interactive className="border-b border-border">
          <ListRow asLink={entry.href} onClick={close} noDivider className={entry.warning ? "bg-warning-soft" : undefined}>
            <span className={entry.warning ? "text-warning text-base font-bold" : "text-base font-semibold text-ink"}>
              {entry.label}
            </span>
          </ListRow>
        </SheetItem>
      ))}
      <SheetItem index={entries.length} className="pt-3">
        <SignOutButton />
      </SheetItem>
    </HeaderMenuButton>
  );
}
