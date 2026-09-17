"use client";

import { useState } from "react";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { updateAutoPrintReceipt, updateStoreInfo } from "@/app/admin/settings/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
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

// Only the auto-print toggle lives here for now — the rest of `Setting`
// (store info, prep-time minutes) has no admin UI yet either; this page is
// a starting point for that, not the full editor, since only the print
// toggle was actually asked for.
export function SettingsScreen({
  settings,
  orderAktifIndicator,
}: {
  settings: StoreSettings;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const [autoPrint, setAutoPrint] = useState(settings.autoPrintReceipt);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function handleChange(next: boolean) {
    if (next === autoPrint) return;
    setAutoPrint(next);
    setSaving(true);
    setSavedFlash(false);
    try {
      const result = await updateAutoPrintReceipt(next);
      if (!result.ok) {
        setAutoPrint(!next); // roll back on failure
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Pengaturan</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <LinkButton href="/dashboard" variant="secondary">Ke Dashboard</LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <StoreInfoCard settings={settings} />

          <Card padded className="flex flex-col gap-2">
            <div>
              <p className="text-ink text-base font-semibold">Cetak struk otomatis</p>
              <p className="text-ink-muted text-sm">
                Nyala: struk langsung tercetak setelah Bayar. Mati: kasir ditanya &ldquo;Cetak struk?&rdquo;
                dulu — transaksi tetap tersimpan penuh apa pun pilihannya.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-pill bg-muted flex h-11 items-center p-0.5 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => handleChange(true)}
                  disabled={saving}
                  className={cn(
                    "rounded-pill h-10 px-4",
                    autoPrint ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                  )}
                >
                  Nyala
                </button>
                <button
                  type="button"
                  onClick={() => handleChange(false)}
                  disabled={saving}
                  className={cn(
                    "rounded-pill h-10 px-4",
                    !autoPrint ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                  )}
                >
                  Mati
                </button>
              </div>
              {savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
