"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";
import Link from "next/link";
import type { FrozenCustomerRow } from "@/lib/frozen/get-frozen-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver } from "@/lib/printing/types";
import { createFrozenPayment } from "@/app/note/frozen-actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";
import { noteAfterSaveHref, noteFormCancelHref, type NoteOrigin } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { FROZEN_PAYMENT_PRESETS } from "@/lib/frozen/types";
import { useFrozenReceiptPrompt } from "@/components/printing/use-frozen-receipt-prompt";
import type { NotePaymentMethod } from "@/lib/note/payment-method";
import { PaymentMethodPicker } from "./payment-method-picker";

export function NewFrozenPaymentForm({
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
  const [amount, setAmount] = useState<number | "">("");
  const [payFull, setPayFull] = useState(false);
  const { offer, prompt } = useFrozenReceiptPrompt({ printerDriver });

  const balanceOf = (id: string) => customers.find((c) => c.id === id)?.balance ?? 0;
  const selectedBalance = balanceOf(customerId);

  function chooseCustomer(id: string) {
    setCustomerId(id);
    if (payFull) {
      const next = balanceOf(id);
      if (next > 0) setAmount(next);
      else {
        setAmount("");
        setPayFull(false);
      }
    }
  }

  function choosePreset(value: number) {
    setAmount(value);
    setPayFull(false);
  }

  function chooseFull() {
    if (selectedBalance <= 0) return;
    setAmount(selectedBalance);
    setPayFull(true);
  }
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  // No default — see new-payment-form.tsx for why.
  const [paymentMethod, setPaymentMethod] = useState<NotePaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !saving && customerId && amount !== "" && Number(amount) > 0 && paymentMethod !== null;

  async function handleSave() {
    if (!paymentMethod) return;
    setSaving(true);
    setError(null);
    const result = await createFrozenPayment({
      customerId,
      amount: Number(amount),
      paymentMethod,
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
        kind: "PEMBAYARAN",
        customerName: result.customerName,
        printedAt: new Date(result.recordedAt),
        amountPaid: result.amountPaid,
        debtAfter: result.debtAfter,
      },
      () => router.push(noteAfterSaveHref("frozen", origin, customerId, result.entryId)),
    );
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Pembayaran Frozen Baru"
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
                  onChange={(e) => chooseCustomer(e.target.value)}
                  className="rounded-input border-border h-12 border px-3 text-base"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · Rp{c.balance.toLocaleString("id-ID")}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Nominal dibayar</span>
              <RupiahInput
                value={amount}
                onChange={(v) => {
                  setAmount(v);
                  setPayFull(false);
                }}
                placeholder="0"
                className="h-12 text-base"
              />
            </label>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih cepat nominal">
              {FROZEN_PAYMENT_PRESETS.map((preset) => {
                const active = !payFull && amount === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => choosePreset(preset)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-pill h-12 min-w-20 px-4 text-base font-semibold",
                      active ? "bg-primary text-white" : "bg-muted text-ink",
                    )}
                  >
                    {preset / 1000}rb
                  </button>
                );
              })}
              <button
                type="button"
                onClick={chooseFull}
                disabled={selectedBalance <= 0}
                aria-pressed={payFull}
                className={cn(
                  "rounded-pill h-12 px-4 text-base font-semibold disabled:opacity-40",
                  payFull ? "bg-primary text-white" : "border-primary text-primary border",
                )}
              >
                {selectedBalance > 0
                  ? `Lunas penuh · Rp${selectedBalance.toLocaleString("id-ID")}`
                  : "Lunas penuh (tidak ada utang)"}
              </button>
            </div>

            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />

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
              {saving ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </Card>
        </div>
      </div>

      {prompt}
    </div>
  );
}
