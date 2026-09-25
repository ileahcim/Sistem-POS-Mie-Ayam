"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FrozenCustomerRow } from "@/lib/frozen/get-frozen-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver } from "@/lib/printing/types";
import { FROZEN_PCS_PRESETS } from "@/lib/frozen/types";
import { createFrozenOrder, getFrozenAutofillPrice } from "@/app/note/frozen-actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";
import { noteAfterSaveHref, noteFormCancelHref, type NoteOrigin } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";
import { useFrozenReceiptPrompt } from "@/components/printing/use-frozen-receipt-prompt";

// "Pengambilan Baru" — pcs taken, priced per pcs. No jenis buttons at all
// (unlike Mi Mentah's order form): Frozen has only one product.
export function NewFrozenOrderForm({
  customers,
  initialCustomerId,
  origin,
  printerDriver,
  store,
  nav,
}: {
  customers: FrozenCustomerRow[];
  initialCustomerId?: string;
  // Where the form was opened from — decides Batal and where a save lands.
  origin: NoteOrigin;
  printerDriver: PrinterDriver;
  store: { storeName: string; address: string | null; phone: string | null; printLogo: boolean };
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [pcs, setPcs] = useState("");
  const [pricePerPcs, setPricePerPcs] = useState<number | "">("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { offer, prompt } = useFrozenReceiptPrompt({ printerDriver });

  // Autofill: this customer's last price if they've had a pickup before,
  // else the buku's owner-set default (see getFrozenAutofillPrice). Only
  // overwrites the field while the owner hasn't typed their own number.
  useEffect(() => {
    if (!customerId || priceManuallyEdited) return;
    let cancelled = false;
    getFrozenAutofillPrice(customerId).then((price) => {
      if (!cancelled && price != null) setPricePerPcs(price);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const pcsNumber = Number(pcs);
  const pcsValid = pcs.trim() !== "" && Number.isInteger(pcsNumber) && pcsNumber > 0;
  const canSave = !saving && customerId && pcsValid && pricePerPcs !== "" && Number(pricePerPcs) > 0;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createFrozenOrder({
      customerId,
      pcs: pcsNumber,
      pricePerPcs: Number(pricePerPcs),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);

    offer(
      {
        storeName: store.storeName,
        address: store.address,
        phone: store.phone,
        printLogo: store.printLogo,
        kind: "PENGAMBILAN",
        customerName: result.customerName,
        printedAt: new Date(result.recordedAt),
        pcs: result.pcs,
        pricePerPcs: result.pricePerPcs,
        pickupTotal: result.amount,
        debtAfter: result.debtAfter,
      },
      () => router.push(noteAfterSaveHref("frozen", origin, customerId, result.entryId)),
    );
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Pengambilan Baru"
        actions={
          <LinkButton href={noteFormCancelHref("frozen", origin, initialCustomerId ?? "")} variant="secondary" size="compact">
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
                <Link href="/note/frozen/pelanggan/baru" className="text-primary font-semibold underline">
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
                    setPriceManuallyEdited(false);
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
              <label className="flex flex-1 flex-col gap-1">
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
              <label className="flex flex-1 flex-col gap-1">
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

            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih cepat jumlah pcs">
              {FROZEN_PCS_PRESETS.map((preset) => (
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

            {pcsValid && pricePerPcs !== "" && (
              <p className="text-ink-muted text-sm">
                Total: Rp{Math.round(pcsNumber * Number(pricePerPcs)).toLocaleString("id-ID")}
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
              {saving ? "Menyimpan..." : "Simpan Pengambilan"}
            </Button>
          </Card>
        </div>
      </div>

      {prompt}
    </div>
  );
}
