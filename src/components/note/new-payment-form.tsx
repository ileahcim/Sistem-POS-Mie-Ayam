"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";
import Link from "next/link";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { createMiePayment } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";
import { cn } from "@/components/ui/cn";
import { MIE_PAYMENT_PRESETS } from "@/lib/mie/types";

// Payments are deliberately NOT tied to a specific order — picking a
// customer and typing an amount is the whole flow (see CLAUDE.md-worthy
// brief: "Kalau Agus bayar 100.000, saldonya berkurang 100.000, tanpa perlu
// memilih itu untuk pesanan yang mana").
export function NewPaymentForm({
  customers,
  initialCustomerId,
  nav,
}: {
  customers: MieCustomerRow[];
  initialCustomerId?: string;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [amount, setAmount] = useState<number | "">("");
  // "Lunas penuh" follows the selected customer: switching customer while
  // it's on re-fills that customer's own remaining balance.
  const [payFull, setPayFull] = useState(false);

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !saving && customerId && amount !== "" && Number(amount) > 0;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createMiePayment({
      customerId,
      amount: Number(amount),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(`/note/pelanggan/${customerId}`);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Pembayaran Baru"
        actions={
          <LinkButton href="/note" variant="secondary" size="compact">
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
              {MIE_PAYMENT_PRESETS.map((preset) => {
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
    </div>
  );
}
