"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MieProductType } from "@/lib/mie/types";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PASAR_LABEL, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import { NOTE_RETURN_QTY_PRESETS, type NoteReturnContext } from "@/lib/note/return-window";
import { createMieReturn, getMieReturnContext } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";
import { noteAfterSaveHref, noteFormCancelHref, type NoteOrigin } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";
import { ReturnPriceHint, ReturnQtyWarning } from "./return-hints";

type JenisChoice = MieProductType | "PASAR";
const JENIS: { value: JenisChoice; label: string }[] = [
  ...MIE_FIXED_PRODUCT_TYPES.map((t) => ({ value: t as JenisChoice, label: MIE_PRODUCT_LABEL[t] })),
  { value: "PASAR", label: MIE_PASAR_LABEL },
  { value: "CUSTOM", label: "Custom" },
];

// "Retur Baru" (Mi Mentah) — mi titip-jual that came back unsold. Same shape
// as Pesanan Baru (jenis, kg, harga/kg), but the harga/kg is the price this
// customer was last SOLD that jenis at (Mi Pasar apart from Reguler), since a
// retur cancels that sale; the amount lowers the debt. Warns — never blocks —
// when the kg is more than they ordered of that jenis in the last days.
export function NewReturnForm({
  customers,
  initialCustomerId,
  origin,
  nav,
}: {
  customers: MieCustomerRow[];
  initialCustomerId?: string;
  origin: NoteOrigin;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [jenis, setJenis] = useState<JenisChoice>("MIE_KERITING");
  const [customLabel, setCustomLabel] = useState("");
  const [kg, setKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState<number | "">("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  // Tagged with what it was read for, so a stale answer (previous customer/
  // jenis/date, still loading) is never shown against the current inputs.
  const [loaded, setLoaded] = useState<{ key: string; context: NoteReturnContext | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productType: MieProductType = jenis === "PASAR" ? "MIE_KERITING" : jenis;
  const isPasar = jenis === "PASAR";

  // Last sale price + the window's ordered kg, re-read whenever the customer,
  // jenis or date changes. The price only fills the field while the owner
  // hasn't typed one.
  const contextKey = `${customerId}|${jenis}|${customLabel.trim().toLowerCase()}|${date}`;
  useEffect(() => {
    if (!customerId || (jenis === "CUSTOM" && !customLabel.trim())) return;
    let cancelled = false;
    getMieReturnContext({ customerId, productType, isPasar, customLabel, date: dateInputToIso(date) }).then((ctx) => {
      if (cancelled) return;
      setLoaded({ key: contextKey, context: ctx });
      if (!priceManuallyEdited && ctx?.lastPrice != null) setPricePerKg(ctx.lastPrice);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, jenis, customLabel, date]);

  function pickJenis(next: JenisChoice) {
    setJenis(next);
    setPriceManuallyEdited(false);
    setPricePerKg("");
  }

  const context = loaded?.key === contextKey ? loaded.context : null;
  const customerName = customers.find((c) => c.id === customerId)?.name ?? "";
  const jenisLabel = jenis === "CUSTOM" ? customLabel.trim() || "Custom" : JENIS.find((j) => j.value === jenis)!.label;
  const kgNumber = Number(kg.replace(",", "."));
  const kgValid = kg.trim() !== "" && Number.isFinite(kgNumber) && kgNumber > 0;
  const canSave =
    !saving &&
    customerId &&
    kgValid &&
    pricePerKg !== "" &&
    Number(pricePerKg) > 0 &&
    (jenis !== "CUSTOM" || customLabel.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createMieReturn({
      customerId,
      productType,
      isPasar,
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
        title="Retur Baru"
        actions={
          <LinkButton href={noteFormCancelHref("mie", origin, initialCustomerId ?? "")} variant="secondary" size="compact">
            Batal
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Card padded className="flex flex-col gap-3">
            <p className="text-ink-muted text-sm">
              Mi titip jual yang kembali tidak laku. Utang pelanggan berkurang sebesar kg × harga/kg.
            </p>
            {customers.length === 0 ? (
              <p className="text-ink-muted text-sm">Belum ada pelanggan aktif.</p>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Pelanggan</span>
                <select
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setPriceManuallyEdited(false);
                    setPricePerKg("");
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
              <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis mi">
                {JENIS.map((j) => (
                  <button
                    key={j.value}
                    type="button"
                    aria-pressed={jenis === j.value}
                    onClick={() => pickJenis(j.value)}
                    className={cn(
                      "rounded-pill h-12 px-4 text-sm font-semibold",
                      jenis === j.value ? "bg-primary text-white" : "bg-muted text-ink-muted",
                    )}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            {jenis === "CUSTOM" && (
              <label className="flex flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Nama jenis mi (sama dengan di pesanannya)</span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
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
                <RupiahInput
                  value={pricePerKg}
                  onChange={(v) => {
                    setPricePerKg(v);
                    setPriceManuallyEdited(true);
                  }}
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
            </div>
            {!priceManuallyEdited && (
              <ReturnPriceHint context={context} itemLabel={`pesanan ${jenisLabel}`} customerName={customerName} unit="kg" />
            )}

            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih cepat jumlah kg">
              {NOTE_RETURN_QTY_PRESETS.map((preset) => (
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

            {kgValid && (
              <ReturnQtyWarning
                qty={kgNumber}
                unit="kg"
                context={context}
                itemLabel={`pesanan ${jenisLabel}`}
                customerName={customerName}
              />
            )}

            {kgValid && pricePerKg !== "" && (
              <p className="text-ink-muted text-sm">
                Mengurangi utang: Rp{Math.round(kgNumber * Number(pricePerKg)).toLocaleString("id-ID")}
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
              {saving ? "Menyimpan..." : "Simpan Retur"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
