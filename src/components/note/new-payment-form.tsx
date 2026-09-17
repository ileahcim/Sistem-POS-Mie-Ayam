"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { createMiePayment } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Payments are deliberately NOT tied to a specific order — picking a
// customer and typing an amount is the whole flow (see CLAUDE.md-worthy
// brief: "Kalau Agus bayar 100.000, saldonya berkurang 100.000, tanpa perlu
// memilih itu untuk pesanan yang mana").
export function NewPaymentForm({
  customers,
  initialCustomerId,
  orderAktifIndicator,
}: {
  customers: MieCustomerRow[];
  initialCustomerId?: string;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [amount, setAmount] = useState<number | "">("");
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
      date: new Date(`${date}T00:00:00`).toISOString(),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(`/note/pelanggan/${customerId}`);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Pembayaran Baru</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton activeCount={orderAktifIndicator.activeCount} lateCount={orderAktifIndicator.lateCount} />
          <LinkButton href="/note" variant="secondary">
            Batal
          </LinkButton>
        </div>
      </div>

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
                  onChange={(e) => setCustomerId(e.target.value)}
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
              <RupiahInput value={amount} onChange={setAmount} placeholder="0" className="h-12 text-base" />
            </label>

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
