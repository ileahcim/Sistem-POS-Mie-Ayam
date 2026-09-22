"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/printing/format";

export type CustomItemResult = { name: string; price: number; qty: number };

// "+ Item Custom" — CLAUDE.md-worthy brief, 22 Sep 2026: a pelanggan orders
// something outside the menu (e.g. "bakso Rp13.000 tapi ditambah baksonya
// jadi Rp20.000"). Free name + free price is the one place in this app that
// genuinely needs typed input as the primary path — everything else stays
// tap-only on purpose (CLAUDE.md "Konteks pengguna"), but there is no tappable
// menu entry for something that isn't on the menu. Shared by Kasir's cart and
// "+ Tambah Item" on an existing order, so the two behave identically.
export function CustomItemSheet({
  onConfirm,
  onClose,
}: {
  onConfirm: (result: CustomItemResult) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [qty, setQty] = useState(1);

  const price = Number(priceStr) || 0;
  const canSave = name.trim().length > 0 && price > 0;

  return (
    <Sheet
      title="Item Custom"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="large"
          fullWidth
          disabled={!canSave}
          onClick={() => onConfirm({ name: name.trim(), price, qty })}
        >
          Tambah - {formatRupiah(price * qty)}
        </Button>
      }
    >
      <div className="py-3">
        <label htmlFor="custom-item-name" className="mb-1 block text-sm font-bold text-ink">
          Nama item
        </label>
        <input
          id="custom-item-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Tambahan bakso"
          className="rounded-input w-full border border-border p-3 text-base"
        />
      </div>

      <div className="py-3">
        <label htmlFor="custom-item-price" className="mb-1 block text-sm font-bold text-ink">
          Harga
        </label>
        <input
          id="custom-item-price"
          type="text"
          inputMode="numeric"
          value={priceStr}
          onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="0"
          className="rounded-input w-full border border-border p-3 text-base"
        />
      </div>

      <div className="flex items-center justify-between py-3">
        <span className="text-sm font-bold text-ink">Jumlah</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-xl text-ink"
            aria-label="Kurangi"
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-semibold text-ink">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-xl text-ink"
            aria-label="Tambah"
          >
            +
          </button>
        </div>
      </div>
    </Sheet>
  );
}
