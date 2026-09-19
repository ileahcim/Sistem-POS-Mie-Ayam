"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver } from "@/lib/printing/types";
import {
  updateAutoPrintReceipt,
  updatePrinterDriver,
  updatePrintLogo,
  updateSheetBlurEnabled,
  updateStoreInfo,
} from "@/app/admin/settings/actions";
import {
  connectPrinter,
  getConnectedPrinterName,
  isWebBluetoothSupported,
  PRINTER_CHANGED_EVENT,
} from "@/lib/printing/printers/web-bluetooth-printer";
import { printTest } from "@/lib/printing/test-print";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { AppHeader } from "@/components/ui/app-header";
import { cn } from "@/components/ui/cn";

const PRINTER_MODE_LABELS: Record<PrinterDriver, { label: string; helper: string }> = {
  mock: { label: "Preview", helper: "Struk ditampilkan di layar — tanpa mencetak." },
  webbluetooth: { label: "Bluetooth", helper: "Cetak langsung dari Chrome — tanpa app, tanpa watermark. Butuh Android + Chrome." },
  rawbt: { label: "RawBT", helper: "Cetak lewat app RawBT (senarai/vendor). Versi gratis mencetak footer kecil." },
};

function subscribePrinterChanged(onChange: () => void): () => void {
  window.addEventListener(PRINTER_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(PRINTER_CHANGED_EVENT, onChange);
}

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

// Print setup — which driver prints to the Blueprint ECO80D and where the
// pairing/test entry points live. Driver choice is saved to the singleton
// Setting row (server-side truth the client printer factory reads every
// print); pairing state is local to THIS tablet's Chrome (Web Bluetooth
// permission + device refs are per-browser, so a fresh tablet must pair
// once again).
function PrinterCard({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [driver, setDriver] = useState<PrinterDriver>(settings.printerDriver);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Pairing state lives in this tablet's localStorage (per-browser), so the
  // label subscribes to it instead of re-rendering from a copied-in value.
  const connectedName = useSyncExternalStore(
    subscribePrinterChanged,
    getConnectedPrinterName,
    () => null,
  );

  async function handleDriverChange(next: PrinterDriver) {
    if (next === driver) return;
    setDriver(next);
    setSaving(true);
    setSavedFlash(false);
    try {
      const result = await updatePrinterDriver(next);
      if (!result.ok) {
        setDriver(driver); // roll back on failure
        setStatus(result.error);
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setStatus(null);
    try {
      const result = await connectPrinter();
      // connectPrinter menyimpan pairing & mengirim PRINTER_CHANGED_EVENT —
      // label "Terhubung" di bawah repaint lewat useSyncExternalStore.
      if (result.ok) {
        setStatus(`Terhubung ke ${result.name}. Tekan Tes Cetak.`);
      } else {
        setStatus(result.error);
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    try {
      const result = await printTest(driver);
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      if (driver === "mock") setStatus("Preview mock muncul di bagian bawah layar.");
      else if (driver === "rawbt") setStatus("Perintah cetak dikirim ke RawBT.");
      else setStatus("Perintah cetak dikirim ke printer Bluetooth.");
    } finally {
      setTesting(false);
    }
  }

  const isWebBt = driver === "webbluetooth";

  return (
    <Card padded className="flex flex-col gap-3">
      <div>
        <p className="text-ink text-base font-semibold">Printer struk</p>
        <p className="text-ink-muted text-sm">Mode cetak untuk printer thermal ECO80D. Pilih driver, lalu Tes Cetak untuk memastikan.</p>
      </div>

      <div role="group" aria-label="Mode cetak" className="rounded-pill bg-muted flex h-11 items-center p-0.5 text-sm font-semibold">
        {(Object.keys(PRINTER_MODE_LABELS) as PrinterDriver[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleDriverChange(option)}
            disabled={saving}
            aria-pressed={driver === option}
            className={cn(
              "rounded-pill h-10 px-4",
              driver === option ? "bg-surface text-ink shadow-card" : "text-ink-muted",
            )}
          >
            {PRINTER_MODE_LABELS[option].label}
          </button>
        ))}
      </div>
      <p className="text-ink-faint text-xs">{PRINTER_MODE_LABELS[driver].helper}</p>

      {isWebBt && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Menghubungkan..." : connectedName ? "Hubungkan ulang" : "Hubungkan Bluetooth"}
          </Button>
          {connectedName && !isWebBluetoothSupported() && (
            <p className="text-danger text-sm">Browser ini tidak mendukung Web Bluetooth — pakai Chrome di Android.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={handleTest} disabled={testing || (isWebBt && !connectedName)}>
          {testing ? "Mencetak..." : "Tes Cetak"}
        </Button>
        {isWebBt && connectedName && <p className="text-primary-strong text-sm font-medium">Terhubung: {connectedName}</p>}
        {savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
      </div>

      {status && (
        <p className={cn("text-sm", status.startsWith("Terhubung") || status.startsWith("Perintah") ? "text-primary-strong" : "text-danger")}>
          {status}
        </p>
      )}
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
          {/* Set up once and then rarely touched, so they live here instead
              of taking up room in the main Menu. */}
          <Card>
            <p className="text-ink px-4 pt-3 pb-1 text-base font-semibold">Data menu</p>
            <ListRow asLink="/admin/hpp">
              <span className="flex flex-1 flex-col">
                <span className="text-ink text-base font-semibold">Isi HPP</span>
                <span className="text-ink-muted text-sm">Modal per produk & add-on, dipakai grafik margin.</span>
              </span>
              <span className="text-ink-faint text-xl">›</span>
            </ListRow>
            <ListRow asLink="/admin/foto-produk">
              <span className="flex flex-1 flex-col">
                <span className="text-ink text-base font-semibold">Foto Produk</span>
                <span className="text-ink-muted text-sm">Unggah foto untuk kartu produk di layar Kasir.</span>
              </span>
              <span className="text-ink-faint text-xl">›</span>
            </ListRow>
          </Card>

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

          <PrinterCard settings={settings} />

          <ToggleCard
            title="Cetak logo di struk"
            description="Nyala: logo warung ikut tercetak di bagian atas struk & daftar packing. Mati: header berisi teks saja — lega kalau hasil logo di kertas printer kurang tajam."
            initialValue={settings.printLogo}
            onSave={updatePrintLogo}
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
