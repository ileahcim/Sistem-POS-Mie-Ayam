"use client";

import { useState } from "react";
import type { ShiftExpense } from "@/lib/shift/get-shift-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { EmptyState } from "@/components/ui/empty-state";
import { NoExpenseIcon } from "@/components/ui/empty-state-icons";
import { addExpense } from "@/app/shift/actions";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { AppHeader } from "@/components/ui/app-header";

export function PengeluaranForm({ initialExpenses, nav }: { initialExpenses: ShiftExpense[]; nav: HeaderNav }) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
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
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Pengeluaran Shift Ini" />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-ink-muted text-sm">
        Opsional — kalau lupa dicatat di sini, tetap bisa diinput sekaligus saat tutup shift nanti.
      </p>

      <Card>
        {expenses.length === 0 && (
          <EmptyState
            icon={<NoExpenseIcon />}
            title="Belum ada pengeluaran"
            description="Catat di sini setiap kali beli gas, bensin, atau keperluan warung lain."
            actionHref="/kasir"
            actionLabel="Ke Kasir"
          />
        )}
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
        <RupiahInput value={amount} onChange={setAmount} placeholder="Nominal" className="h-11 text-sm" />
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button variant="primary" size="large" fullWidth disabled={saving || !description.trim() || !amount} onClick={handleAdd}>
          + Tambah Pengeluaran
        </Button>
      </Card>
      </div>
    </div>
  );
}
