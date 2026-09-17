import { HeaderMenuButton } from "./header-menu-button";
import { ListRow } from "./list-row";
import { SignOutButton } from "@/components/auth/sign-out-button";

// The single shared navigation menu for the app — every destination lives
// here now instead of being scattered across per-screen header buttons.
// Rendered identically on every screen so there is only one nav to keep in
// sync as destinations are added. "Order Aktif" graduated out of this list
// into its own always-visible header button (OrderAktifButton) since it
// needs to carry the late-order indicator — see CLAUDE.md-worthy brief.
// "Tutup Shift" is visually set apart (warning tint) since it's the one
// deliberate, once-a-day action mixed in among the read/navigate-only items.
export function MainMenu({ isOwner }: { isOwner: boolean }) {
  return (
    <HeaderMenuButton>
      <ListRow asLink="/riwayat-pesanan">
        <span className="text-base font-semibold text-ink">Riwayat Pesanan</span>
      </ListRow>
      {isOwner && (
        <ListRow asLink="/dashboard">
          <span className="text-base font-semibold text-ink">Dashboard</span>
        </ListRow>
      )}
      {isOwner && (
        <ListRow asLink="/admin/hpp">
          <span className="text-base font-semibold text-ink">Isi HPP</span>
        </ListRow>
      )}
      {isOwner && (
        <ListRow asLink="/note">
          <span className="text-base font-semibold text-ink">Note (Mi Mentah)</span>
        </ListRow>
      )}
      {isOwner && (
        <ListRow asLink="/admin/settings">
          <span className="text-base font-semibold text-ink">Pengaturan</span>
        </ListRow>
      )}
      <ListRow asLink="/pesanan-terjadwal">
        <span className="text-base font-semibold text-ink">Pesanan Terjadwal</span>
      </ListRow>
      <ListRow asLink="/piutang">
        <span className="text-base font-semibold text-ink">Piutang</span>
      </ListRow>
      <ListRow asLink="/shift/pengeluaran">
        <span className="text-base font-semibold text-ink">Pengeluaran</span>
      </ListRow>
      <ListRow asLink="/shift/tutup" className="bg-warning-soft">
        <span className="text-warning text-base font-bold">Tutup Shift</span>
      </ListRow>
      <div className="pt-3">
        <SignOutButton />
      </div>
    </HeaderMenuButton>
  );
}
