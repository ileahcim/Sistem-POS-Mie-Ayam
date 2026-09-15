"use client";

import { useState } from "react";
import type { ShiftExpense } from "@/lib/shift/get-shift-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { addExpense } from "@/app/shift/actions";

export function PengeluaranForm({ initialExpenses }: { initialExpenses: ShiftExpense[] }) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    const result = await addExpense(description, Number(amount));
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setExpenses((list) => [...list, { id: crypto.randomUUID(), description: description.trim(), amount: Number(amount) }]);
    setDescription("");
    setAmount("");
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col gap-3 p-4">
      <h1 className="text-xl font-bold text-ink">Pengeluaran Shift Ini</h1>
      <p className="text-ink-muted text-sm">
        Opsional — kalau lupa dicatat di sini, tetap bisa diinput sekaligus saat tutup shift nanti.
      </p>

      <Card>
        {expenses.length === 0 && <p className="text-ink-faint p-4 text-sm">Belum ada pengeluaran.</p>}
        <div className="divide-border flex flex-col divide-y">
          {expenses.map((e) => (
            <div key={e.id} className="flex justify-between p-4 text-sm">
              <span className="text-ink">{e.description}</span>
              <PriceText amount={e.amount} weight="secondary" />
            </div>
          ))}
        </div>
      </Card>

      <Card padded className="flex flex-col gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Keterangan (mis. Beli gas)"
          className="rounded-input border-border h-11 border px-3 text-sm"
        />
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Nominal"
          className="rounded-input border-border h-11 border px-3 text-sm"
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button variant="primary" size="large" fullWidth disabled={saving || !description.trim() || !amount} onClick={handleAdd}>
          + Tambah Pengeluaran
        </Button>
      </Card>
    </div>
  );
}
