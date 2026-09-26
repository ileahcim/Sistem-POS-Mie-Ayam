"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MiePriceSource, MieProductType } from "@/lib/mie/types";
import type { MieDefaultJenis } from "@/lib/mie/get-mie-default-jenis";
import { MIE_FIXED_PRODUCT_TYPES, MIE_KG_PRESETS, MIE_PASAR_PRODUCT_TYPE, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import { createMieOrder, getMieAutofillPrice } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { LockedPrice } from "./locked-price";
import { AppHeader } from "@/components/ui/app-header";
import { noteAfterSaveHref, noteFormCancelHref, type NoteOrigin } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";

export function NewOrderForm({
  customers,
  initialCustomerId,
  origin,
  pasarPricePerKg,
  defaultJenis,
  nav,
}: {
  customers: MieCustomerRow[];
  initialCustomerId?: string;
  // Where the form was opened from — decides Batal and where a save lands.
  origin: NoteOrigin;
  pasarPricePerKg: number | null;
  // customerId → jenis of their last pesanan (getMieDefaultJenis).
  defaultJenis: Record<string, MieDefaultJenis>;
  nav: HeaderNav;
}) {
  const router = useRouter();
  // The jenis a customer's form opens on: their last pesanan's (Pasar → Mi
  // Pasar), else Mi Keriting. Mi Pasar needs its price set in Harga Produk.
  function startFor(id: string): { productType: MieProductType; pasar: boolean } {
    const j = defaultJenis[id];
    if (j === "PASAR") return { productType: MIE_PASAR_PRODUCT_TYPE, pasar: pasarPricePerKg != null };
    return { productType: j ?? "MIE_KERITING", pasar: false };
  }
  const firstCustomerId = initialCustomerId ?? customers[0]?.id ?? "";
  const first = startFor(firstCustomerId);
  const [customerId, setCustomerId] = useState(firstCustomerId);
  const [productType, setProductType] = useState<MieProductType>(first.productType);
  const [customLabel, setCustomLabel] = useState("");
  const [kg, setKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState<number | "">(first.pasar && pasarPricePerKg != null ? pasarPricePerKg : "");
  // Where the price came from — shown under the field, so a general 17.000
  // that should have been this customer's own price is easy to spot. null =
  // still loading; "none" = no default exists at all (the field is then
  // typed like before).
  const [priceSource, setPriceSource] = useState<MiePriceSource | "pasar" | "none" | null>(first.pasar ? "pasar" : null);
  // "Bekukan harga" (26 Sep 2026, owner's request): a price that came from
  // harga khusus / harga terakhir / harga umum / harga pasar is LOCKED — it
  // can't be changed by a stray tap. "Ubah harga" unlocks it for this one
  // pesanan; changing the customer or jenis locks it again on the new price.
  const [unlocked, setUnlocked] = useState(false);
  // Mi Pasar = Mi Keriting on the pasar price and pasar modal.
  const [pasarPreset, setPasarPreset] = useState(first.pasar);
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autofill: this customer's harga khusus, else their last price for this
  // product, else the product's owner-set default (see getMieAutofillPrice) —
  // never for CUSTOM, which is always priced fresh, and never over a price
  // the owner unlocked and typed.
  useEffect(() => {
    if (productType === "CUSTOM" || !customerId || unlocked || pasarPreset) return;
    let cancelled = false;
    getMieAutofillPrice(customerId, productType).then((result) => {
      if (cancelled) return;
      if (result) setPricePerKg(result.price);
      setPriceSource(result?.source ?? "none");
    });
    return () => {
      cancelled = true;
    };
    // pasarPreset is a dependency because Mi Pasar is Mi Keriting underneath:
    // tapping Mi Pasar then Mi Keriting leaves productType unchanged, and
    // without it the market price would stay in the field.
  }, [customerId, productType, pasarPreset, unlocked]);

  function applyPasarPreset() {
    if (pasarPricePerKg == null) return;
    setProductType(MIE_PASAR_PRODUCT_TYPE);
    setPricePerKg(pasarPricePerKg);
    setPriceSource("pasar");
    setUnlocked(false);
    setPasarPreset(true);
  }

  function handleProductTypeChange(next: MieProductType) {
    // Same jenis tapped again with nothing changed: keep the price as is (the
    // autofill wouldn't run again to refill a cleared field).
    if (next === productType && !pasarPreset && !unlocked) return;
    setPasarPreset(false);
    setProductType(next);
    setUnlocked(false);
    setPricePerKg("");
    setPriceSource(next === "CUSTOM" ? "none" : null);
  }

  function handleCustomerChange(next: string) {
    const start = startFor(next);
    setCustomerId(next);
    setProductType(start.productType);
    setPasarPreset(start.pasar);
    setUnlocked(false);
    setPricePerKg(start.pasar && pasarPricePerKg != null ? pasarPricePerKg : "");
    setPriceSource(start.pasar ? "pasar" : null);
  }

  const locked = !unlocked && productType !== "CUSTOM" && priceSource !== "none";

  const customerName = customers.find((c) => c.id === customerId)?.name ?? "";
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
                  onChange={(e) => handleCustomerChange(e.target.value)}
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
              <label className="flex min-w-0 flex-1 flex-col gap-1">
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
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Harga/kg</span>
                {locked ? (
                  <LockedPrice value={pricePerKg} unit="kg" />
                ) : (
                  // Unlocked: a Mi Pasar pesanan stays Mi Pasar at another
                  // price — the jenis is the button, not the number.
                  <RupiahInput value={pricePerKg} onChange={setPricePerKg} placeholder="0" className="h-12 text-base" />
                )}
              </label>
            </div>

            {productType !== "CUSTOM" && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink-muted min-w-0 flex-1 basis-48 text-sm" data-testid="price-source">
                  {unlocked
                    ? "Harga diubah untuk pesanan ini saja."
                    : priceSource === "pasar"
                      ? "Harga pasar (dari Harga Produk)."
                      : priceSource === "khusus"
                        ? `Harga khusus ${customerName}.`
                        : priceSource === "terakhir"
                          ? `Harga terakhir ${customerName} (belum ada harga khusus).`
                          : priceSource === "umum"
                            ? `Harga umum — ${customerName} belum punya harga khusus.`
                            : priceSource === "none"
                              ? "Harga umum belum diisi — ketik harga/kg."
                              : "Memuat harga…"}
                </p>
                {locked && pricePerKg !== "" && (
                  <Button variant="secondary" size="compact" onClick={() => setUnlocked(true)}>
                    Ubah harga
                  </Button>
                )}
              </div>
            )}

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
