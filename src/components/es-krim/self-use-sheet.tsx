"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { cn } from "@/components/ui/cn";
import { recordSelfUse } from "@/app/es-krim/actions";

export type SelfUseProduct = { id: string; name: string; stock: number };

// "Ambil Sendiri" — family took es krim from the freezer (docs/spec-es-krim.md
// "Ambil Sendiri"). Pick a product, set the count, optionally who — one tap
// to save. Never a sale: no shift, no cash, only a stock row. Any role.
// Rendered inside the caller's AnimatePresence.
export function SelfUseSheet({
  products,
  onClose,
  onDone,
}: {
  products: SelfUseProduct[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [takenBy, setTakenBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = products.find((p) => p.id === productId) ?? null;

  function pick(id: string) {
    setProductId(id);
    setQty(1);
    setError(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const result = await recordSelfUse({ productId: selected.id, qty, takenBy });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(`Tercatat: ${qty} ${selected.name} diambil sendiri.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Ambil Sendiri (tidak dijual)"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button variant="primary" size="large" fullWidth disabled={!selected || saving} onClick={handleSave}>
            {saving ? "Menyimpan..." : selected ? `Catat ${qty} ${selected.name}` : "Pilih es krim dulu"}
          </Button>
        </div>
      }
    >
      <p className="text-ink-muted mb-3 text-sm">Untuk es krim yang dimakan keluarga. Tidak masuk penjualan dan kas.</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {products.map((p) => {
          const active = p.id === productId;
          const empty = p.stock <= 0;
          return (
            <button
              key={p.id}
              type="button"
              disabled={empty}
              onClick={() => pick(p.id)}
              aria-pressed={active}
              className={cn(
                "rounded-card flex min-h-16 flex-col items-start justify-center border px-3 py-2 text-left",
                active ? "border-primary bg-primary-soft" : "border-border bg-surface",
                empty && "bg-muted opacity-50",
              )}
            >
              <span className="text-ink text-sm leading-tight font-bold">{p.name}</span>
              <span className="text-ink-muted text-xs">{empty ? "Stok habis" : `stok ${p.stock}`}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink text-sm font-bold">Jumlah</span>
            <QtyStepper
              qty={qty}
              label={selected.name}
              onDecrement={() => setQty((q) => Math.max(1, q - 1))}
              onIncrement={() => setQty((q) => Math.min(selected.stock, q + 1))}
              decrementDisabled={qty <= 1}
              incrementDisabled={qty >= selected.stock}
            />
          </div>
          <div>
            <label htmlFor="self-use-name" className="text-ink-muted mb-1 block text-sm">
              Yang ambil (opsional)
            </label>
            <input
              id="self-use-name"
              type="text"
              value={takenBy}
              onChange={(e) => setTakenBy(e.target.value)}
              placeholder="mis. Adik"
              maxLength={60}
              className="rounded-input border-border h-12 w-full border px-3 text-base"
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
