"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { updateAutoPrintReceipt, updateSheetBlurEnabled, updateStoreInfo } from "@/app/admin/settings/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/ui/app-header";
import { cn } from "@/components/ui/cn";

// "Data Warung" card — name/address/phone printed on every receipt header
// (see receipt-meta.tsx). Same explicit Simpan + "Tersimpan ✓" flash
// pattern as the auto-print toggle below, not silent auto-save.
function StoreInfoCard({ settings }: { settings: StoreSettings }) {
  const initialAddress = settings.address ?? "";
  const initialPhone = settings.phone ?? "";
  const [storeName, setStoreName] = useState(settings.storeName);
  const [address, setAddress] = useState(initialAddress);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = storeName !== settings.storeName || address !== initialAddress || phone !== initialPhone;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const result = await updateStoreInfo({ storeName, address, phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padded className="flex flex-col gap-3">
      <div>
        <p className="text-ink text-base font-semibold">Data Warung</p>
        <p className="text-ink-muted text-sm">Dicetak di header setiap struk dan daftar packing.</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Nama warung</span>
        <input
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="rounded-input border-border h-12 border px-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Alamat</span>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          placeholder={"Baris 1\nBaris 2 (opsional)"}
          className="rounded-input border-border border px-3 py-2 text-base"
        />
        <span className="text-ink-faint text-xs">Enter untuk baris baru — dicetak persis seperti ditulis.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Nomor HP</span>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-input border-border h-12 border px-3 text-base"
        />
      </label>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        {dirty && (
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        )}
        {!dirty && savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
      </div>
    </Card>
  );
}

// One Nyala/Mati setting, saved immediately on tap (with rollback on
// failure) — same pattern for every on/off switch on this page.
function ToggleCard({
  title,
  description,
  initialValue,
  onSave,
}: {
  title: string;
  description: ReactNode;
  initialValue: boolean;
  onSave: (next: boolean) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function handleChange(next: boolean) {
    if (next === value) return;
    setValue(next);
    setSaving(true);
    setSavedFlash(false);
    try {
      const result = await onSave(next);
      if (!result.ok) {
        setValue(!next); // roll back on failure
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padded className="flex flex-col gap-2">
      <div>
        <p className="text-ink text-base font-semibold">{title}</p>
        <p className="text-ink-muted text-sm">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <div role="group" aria-label={title} className="rounded-pill bg-muted flex h-11 items-center p-0.5 text-sm font-semibold">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              onClick={() => handleChange(option)}
              disabled={saving}
              aria-pressed={value === option}
              className={cn(
                "rounded-pill h-10 px-4",
                value === option ? "bg-surface text-ink shadow-card" : "text-ink-muted",
              )}
            >
              {option ? "Nyala" : "Mati"}
            </button>
          ))}
        </div>
        {savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
      </div>
    </Card>
  );
}

export function SettingsScreen({
  settings,
  nav,
}: {
  settings: StoreSettings;
  nav: HeaderNav;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Pengaturan" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <StoreInfoCard settings={settings} />

          <ToggleCard
            title="Cetak struk otomatis"
            description={
              <>
                Nyala: struk langsung tercetak setelah Bayar. Mati: kasir ditanya &ldquo;Cetak struk?&rdquo; dulu —
                transaksi tetap tersimpan penuh apa pun pilihannya.
              </>
            }
            initialValue={settings.autoPrintReceipt}
            onSave={updateAutoPrintReceipt}
          />

          <ToggleCard
            title="Efek blur animasi"
            description="Efek buram saat menu, pilihan add-on, dan konfirmasi muncul. Matikan kalau tablet terasa tersendat — animasi geraknya tetap ada."
            initialValue={settings.sheetBlurEnabled}
            onSave={updateSheetBlurEnabled}
          />
        </div>
      </div>
    </div>
  );
}
