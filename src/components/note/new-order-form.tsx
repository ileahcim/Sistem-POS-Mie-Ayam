"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MieProductType } from "@/lib/mie/types";
import { MIE_FIXED_PRODUCT_TYPES, MIE_KG_PRESETS, MIE_PASAR_PRODUCT_TYPE, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import { createMieOrder, getMieAutofillPrice } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";
import { noteAfterSaveHref, noteFormCancelHref, type NoteOrigin } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";

export function NewOrderForm({
  customers,
  initialCustomerId,
  origin,
  pasarPricePerKg,
  nav,
}: {
  customers: MieCustomerRow[];
  initialCustomerId?: string;
  // Where the form was opened from — decides Batal and where a save lands.
  origin: NoteOrigin;
  pasarPricePerKg: number | null;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [productType, setProductType] = useState<MieProductType>("MIE_KERITING");
  const [customLabel, setCustomLabel] = useState("");
  const [kg, setKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState<number | "">("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  // While the "Mie Pasar" preset is on, its fixed price must survive a
  // customer change (the owner often taps the preset first, then picks the
  // customer) — the per-customer autofill stays out of the way.
  const [pasarPreset, setPasarPreset] = useState(false);
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autofill: this customer's last price for this product, else the
  // product's owner-set default (see getMieAutofillPrice) — never for
  // CUSTOM, which is always priced fresh. Only overwrites the field while
  // the owner hasn't typed their own number for this customer/product pair.
  useEffect(() => {
    if (productType === "CUSTOM" || !customerId || priceManuallyEdited) return;
    let cancelled = false;
    getMieAutofillPrice(customerId, productType).then((price) => {
      if (!cancelled && price != null) setPricePerKg(price);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, productType]);

  function applyPasarPreset() {
    if (pasarPricePerKg == null) return;
    setProductType(MIE_PASAR_PRODUCT_TYPE);
    setPricePerKg(pasarPricePerKg);
    setPriceManuallyEdited(true);
    setPasarPreset(true);
  }

  function handleProductTypeChange(next: MieProductType) {
    setPasarPreset(false);
    setProductType(next);
    setPriceManuallyEdited(false);
    if (next === "CUSTOM") setPricePerKg("");
  }

  const kgNumber = Number(kg.replace(",", "."));
  const kgValid = kg.trim() !== "" && Number.isFinite(kgNumber) && kgNumber > 0;
  const canSave =
    !saving &&
    customerId &&
    kgValid &&
    pricePerKg !== "" &&
    Number(pricePerKg) > 0 &&
    (productType !== "CUSTOM" || customLabel.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createMieOrder({
      customerId,
      productType,
      // Recorded on the row so Ringkasan's margin uses the Mi Pasar modal
      // (different recipe), not the Reguler one.
      isPasar: pasarPreset,
      customLabel,
      kg: kgNumber,
      pricePerKg: Number(pricePerKg),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(noteAfterSaveHref("mie", origin, customerId, result.entryId));
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Pesanan Baru"
        actions={
          <LinkButton href={noteFormCancelHref("mie", origin, initialCustomerId ?? "")} variant="secondary" size="compact">
            Batal
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Card padded className="flex flex-col gap-3">
            {customers.length === 0 ? (
              <p className="text-ink-muted text-sm">
                Belum ada pelanggan.{" "}
                <Link href="/note/pelanggan/baru" className="text-primary font-semibold underline">
                  Tambah pelanggan
                </Link>{" "}
                dulu.
              </p>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Pelanggan</span>
                <select
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    if (!pasarPreset) setPriceManuallyEdited(false);
                  }}
                  className="rounded-input border-border h-12 border px-3 text-base"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Jenis mi</span>
              <div className="flex flex-wrap gap-2">
                {MIE_FIXED_PRODUCT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleProductTypeChange(type)}
                    className={cn(
                      "rounded-pill h-11 px-4 text-sm font-semibold",
                      productType === type && !pasarPreset ? "bg-primary text-white" : "bg-muted text-ink-muted",
                    )}
                  >
                    {MIE_PRODUCT_LABEL[type]}
                  </button>
                ))}
                {/* "Mi Pasar" is the daily market order: the same Mi Keriting
                    row, but priced from Harga Produk instead of this
                    customer's last price — so it belongs in this row, as one
                    more choice, not in a separate card above the form. */}
                <button
                  type="button"
                  onClick={applyPasarPreset}
                  disabled={pasarPricePerKg == null}
                  title={pasarPricePerKg == null ? "Harga belum diisi di Harga Produk" : undefined}
                  className={cn(
                    "rounded-pill h-11 px-4 text-sm font-semibold disabled:opacity-50",
                    pasarPreset ? "bg-primary text-white" : "bg-muted text-ink-muted",
                  )}
                >
                  Mi Pasar
                </button>
                <button
                  type="button"
                  onClick={() => handleProductTypeChange("CUSTOM")}
                  className={cn(
                    "rounded-pill h-11 px-4 text-sm font-semibold",
                    productType === "CUSTOM" ? "bg-primary text-white" : "bg-muted text-ink-muted",
                  )}
                >
                  Custom
                </button>
              </div>
              {pasarPreset && pasarPricePerKg != null && (
                <span className="text-ink-muted text-sm">
                  {MIE_PRODUCT_LABEL[MIE_PASAR_PRODUCT_TYPE]}, harga pasar Rp
                  {pasarPricePerKg.toLocaleString("id-ID")}/kg (dari Harga Produk).
                </span>
              )}
              {pasarPricePerKg == null && (
                <span className="text-ink-muted text-sm">Harga Mi Pasar belum diisi di halaman Harga Produk.</span>
              )}
            </div>

            {productType === "CUSTOM" && (
              <label className="flex flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Nama jenis mi (request khusus)</span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Mis. Mi Kuning Tebal"
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
            )}

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Jumlah (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kg}
                  onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0"
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Harga/kg</span>
                <RupiahInput
                  value={pricePerKg}
                  onChange={(v) => {
                    setPricePerKg(v);
                    setPriceManuallyEdited(true);
                    if (v !== pasarPricePerKg) setPasarPreset(false);
                  }}
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih cepat jumlah kg">
              {MIE_KG_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setKg(String(preset))}
                  aria-pressed={kgValid && kgNumber === preset}
                  className={cn(
                    "rounded-pill h-12 min-w-16 px-4 text-base font-semibold",
                    kgValid && kgNumber === preset ? "bg-primary text-white" : "bg-muted text-ink",
                  )}
                >
                  {preset} kg
                </button>
              ))}
            </div>

            {kgValid && pricePerKg !== "" && (
              <p className="text-ink-muted text-sm">
                Total: Rp{Math.round(kgNumber * Number(pricePerKg)).toLocaleString("id-ID")}
              </p>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Tanggal</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Catatan (opsional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            {error && <p className="text-danger text-sm">{error}</p>}

            <Button variant="primary" size="large" fullWidth disabled={!canSave} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan Pesanan"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
