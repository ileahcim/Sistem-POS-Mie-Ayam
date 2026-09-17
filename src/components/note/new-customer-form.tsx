"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { createMieCustomer } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";

export function NewCustomerForm({ orderAktifIndicator }: { orderAktifIndicator: OrderAktifIndicator }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [initialBalance, setInitialBalance] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createMieCustomer(name, note, initialBalance === "" ? 0 : initialBalance);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(`/note/pelanggan/${result.customerId}`);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Pelanggan Baru</h1>
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
            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Nama pelanggan</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama"
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Keterangan (opsional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mis. pelanggan langsung / pasar Ciroyom"
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Saldo awal utang (opsional)</span>
              <RupiahInput value={initialBalance} onChange={setInitialBalance} placeholder="0" className="h-12 text-base" />
              <span className="text-ink-faint text-xs">
                Isi kalau pelanggan ini sudah punya utang berjalan dari catatan kertas lama.
              </span>
            </label>

            {error && <p className="text-danger text-sm">{error}</p>}

            <Button variant="primary" size="large" fullWidth disabled={saving || !name.trim()} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan Pelanggan"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
