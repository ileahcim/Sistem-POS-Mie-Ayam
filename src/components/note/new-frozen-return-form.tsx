"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FrozenCustomerRow } from "@/lib/frozen/get-frozen-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { NOTE_RETURN_QTY_PRESETS, type NoteReturnContext } from "@/lib/note/return-window";
import { createFrozenReturn, getFrozenReturnContext } from "@/app/note/frozen-actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";
import { noteAfterSaveHref, noteFormCancelHref, type NoteOrigin } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";
import { ReturnPriceHint, ReturnQtyWarning } from "./return-hints";

// "Retur Baru" (Frozen) — pcs given back unsold by the reseller. Mirrors the
// Mi Mentah retur form without jenis: harga/pcs from the customer's last
// pengambilan, the amount lowers the debt, a warning (never a block) when the
// pcs is more than they took in the last days. No "Cetak bukti".
export function NewFrozenReturnForm({
  customers,
  initialCustomerId,
  origin,
  nav,
}: {
  customers: FrozenCustomerRow[];
  initialCustomerId?: string;
  origin: NoteOrigin;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [pcs, setPcs] = useState("");
  const [pricePerPcs, setPricePerPcs] = useState<number | "">("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  // Tagged with what it was read for — see new-return-form.tsx.
  const [loaded, setLoaded] = useState<{ key: string; context: NoteReturnContext | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextKey = `${customerId}|${date}`;
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    getFrozenReturnContext({ customerId, date: dateInputToIso(date) }).then((ctx) => {
      if (cancelled) return;
      setLoaded({ key: contextKey, context: ctx });
      if (!priceManuallyEdited && ctx?.lastPrice != null) setPricePerPcs(ctx.lastPrice);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, date]);

  const context = loaded?.key === contextKey ? loaded.context : null;
  const customerName = customers.find((c) => c.id === customerId)?.name ?? "";
  const pcsNumber = Number(pcs);
  const pcsValid = pcs.trim() !== "" && Number.isInteger(pcsNumber) && pcsNumber > 0;
  const canSave = !saving && customerId && pcsValid && pricePerPcs !== "" && Number(pricePerPcs) > 0;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createFrozenReturn({
      customerId,
      pcs: pcsNumber,
      pricePerPcs: Number(pricePerPcs),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(noteAfterSaveHref("frozen", origin, customerId, result.entryId));
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Retur Baru"
        actions={
          <LinkButton href={noteFormCancelHref("frozen", origin, initialCustomerId ?? "")} variant="secondary" size="compact">
            Batal
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Card padded className="flex flex-col gap-3">
            <p className="text-ink-muted text-sm">
              Mi frozen titipan yang kembali tidak laku. Utang pelanggan berkurang sebesar pcs × harga/pcs.
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
                    setPricePerPcs("");
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

            <div className="flex gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Jumlah (pcs)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pcs}
                  onChange={(e) => setPcs(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="0"
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Harga/pcs</span>
                <RupiahInput
                  value={pricePerPcs}
                  onChange={(v) => {
                    setPricePerPcs(v);
                    setPriceManuallyEdited(true);
                  }}
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
            </div>
            {!priceManuallyEdited && (
              <ReturnPriceHint context={context} itemLabel="pengambilan" customerName={customerName} unit="pcs" />
            )}

            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih cepat jumlah pcs">
              {NOTE_RETURN_QTY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPcs(String(preset))}
                  aria-pressed={pcsValid && pcsNumber === preset}
                  className={cn(
                    "rounded-pill h-12 min-w-16 px-4 text-base font-semibold",
                    pcsValid && pcsNumber === preset ? "bg-primary text-white" : "bg-muted text-ink",
                  )}
                >
                  {preset} pcs
                </button>
              ))}
            </div>

            {pcsValid && (
              <ReturnQtyWarning qty={pcsNumber} unit="pcs" context={context} itemLabel="pengambilan" customerName={customerName} />
            )}

            {pcsValid && pricePerPcs !== "" && (
              <p className="text-ink-muted text-sm">
                Mengurangi utang: Rp{Math.round(pcsNumber * Number(pricePerPcs)).toLocaleString("id-ID")}
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
