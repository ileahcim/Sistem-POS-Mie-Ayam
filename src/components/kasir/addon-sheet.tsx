"use client";

import { useMemo, useState } from "react";
import type { MenuAddonGroup, MenuProduct } from "@/lib/menu/get-active-menu";
import type { CartAddon } from "@/lib/cart/types";
import { Sheet } from "@/components/ui/sheet";
import { SheetItem } from "@/components/ui/sheet-motion";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { formatRupiah } from "@/lib/printing/format";

export type AddonSheetInitial = {
  addons: CartAddon[];
  notes: string;
  qty: number;
};

export type AddonSheetResult = {
  addons: CartAddon[];
  notes: string;
  qty: number;
};

// Stagger order inside the sheet: product header, then every option row
// top to bottom, then notes and qty. Capped so a product with many options
// never makes the cashier wait for the last rows to appear.
const MAX_STAGGER_INDEX = 8;
const stagger = (i: number) => Math.min(i, MAX_STAGGER_INDEX);

function isRequired(group: MenuAddonGroup) {
  return group.minSelect > 0;
}

function ruleLabel(group: MenuAddonGroup) {
  if (!isRequired(group)) return "Opsional";
  return group.maxSelect === group.minSelect
    ? `Harus dipilih · Pilih ${group.minSelect}`
    : `Harus dipilih · Pilih min. ${group.minSelect}`;
}

export function AddonSheet({
  product,
  initial,
  onConfirm,
  onClose,
}: {
  product: MenuProduct;
  initial?: AddonSheetInitial;
  onConfirm: (result: AddonSheetResult) => void;
  onClose: () => void;
}) {
  // optionId -> qty (0/absent = not selected). A single-select (radio)
  // group's chosen option always sits at qty 1; a multi-select group's
  // options can go above 1 via the stepper below.
  const [qtyByOption, setQtyByOption] = useState<Map<string, number>>(
    () => new Map((initial?.addons ?? []).map((a) => [a.addonOptionId, a.qty])),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [qty, setQty] = useState(initial?.qty ?? 1);

  const optionToGroup = useMemo(() => {
    const map = new Map<string, MenuAddonGroup>();
    for (const group of product.addonGroups) {
      for (const opt of group.options) map.set(opt.id, group);
    }
    return map;
  }, [product]);

  function selectSingle(group: MenuAddonGroup, optionId: string) {
    setQtyByOption((prev) => {
      const next = new Map(prev);
      for (const opt of group.options) next.delete(opt.id);
      next.set(optionId, 1);
      return next;
    });
  }

  function setOptionQty(optionId: string, nextQty: number) {
    setQtyByOption((prev) => {
      const next = new Map(prev);
      if (nextQty <= 0) next.delete(optionId);
      else next.set(optionId, nextQty);
      return next;
    });
  }

  const unitAddonsTotal = useMemo(() => {
    let sum = 0;
    for (const group of product.addonGroups) {
      for (const opt of group.options) {
        sum += opt.price * (qtyByOption.get(opt.id) ?? 0);
      }
    }
    return sum;
  }, [product, qtyByOption]);

  const unitTotal = product.price + unitAddonsTotal;
  const grandTotal = unitTotal * qty;

  const allRequiredSatisfied = product.addonGroups.every((group) => {
    if (!isRequired(group)) return true;
    const count = group.options.filter((o) => (qtyByOption.get(o.id) ?? 0) > 0).length;
    return count >= group.minSelect;
  });

  function handleConfirm() {
    const addons: CartAddon[] = [];
    for (const group of product.addonGroups) {
      for (const opt of group.options) {
        const optQty = qtyByOption.get(opt.id) ?? 0;
        if (optQty > 0) addons.push({ addonOptionId: opt.id, name: opt.name, price: opt.price, qty: optQty });
      }
    }
    onConfirm({ addons, notes: notes.trim(), qty });
  }

  let optionIndex = 0;

  return (
    <Sheet
      title="Custom pembelian"
      onClose={onClose}
      footer={
        <Button variant="primary" size="large" fullWidth disabled={!allRequiredSatisfied} onClick={handleConfirm}>
          {initial ? "Simpan perubahan" : "Tambah pesanan"} - {formatRupiah(grandTotal)}
        </Button>
      }
    >
      <SheetItem index={0} className="flex items-baseline justify-between border-b border-border pb-3">
        <span className="text-lg font-bold text-ink">{product.name}</span>
        <PriceText amount={product.price} weight="primary" className="text-lg" />
      </SheetItem>

      {product.addonGroups.map((group) => {
        const isSingle = group.maxSelect === 1;
        return (
          <div key={group.id} className="border-b border-border py-3">
            <div className="mb-2">
              <div className="text-sm font-bold text-ink">{group.name}</div>
              <div className={`text-xs ${isRequired(group) ? "text-primary-strong" : "text-ink-muted"}`}>
                {ruleLabel(group)}
              </div>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {group.options.map((opt) => {
                const optQty = qtyByOption.get(opt.id) ?? 0;
                const checked = optQty > 0;
                const itemIndex = stagger(++optionIndex);

                if (isSingle) {
                  return (
                    <SheetItem key={opt.id} index={itemIndex} interactive>
                    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2">
                      <span className="text-base text-ink">{opt.name}</span>
                      <span className="flex items-center gap-3">
                        {opt.price > 0 ? (
                          <PriceText amount={opt.price} weight="secondary" prefix="+" />
                        ) : (
                          <span className="text-sm font-medium text-ink-muted">Gratis</span>
                        )}
                        {/* An optional single-choice group (e.g. "Jenis Bakso":
                            nothing picked = plain Bakso) must be un-pickable
                            again — a native radio can't be unchecked, so a
                            tap on the already-checked option clears it.
                            onChange never fires in that case, onClick does. */}
                        <input
                          type="radio"
                          name={group.id}
                          checked={checked}
                          onChange={() => selectSingle(optionToGroup.get(opt.id) ?? group, opt.id)}
                          onClick={() => {
                            if (checked && !isRequired(group)) setOptionQty(opt.id, 0);
                          }}
                          className="text-primary h-5 w-5 accent-current"
                        />
                      </span>
                    </label>
                    </SheetItem>
                  );
                }

                return (
                  <SheetItem key={opt.id} index={itemIndex} interactive>
                  <div className="flex min-h-12 items-center justify-between gap-3 py-2">
                    <span className="text-base text-ink">{opt.name}</span>
                    <span className="flex items-center gap-3">
                      {opt.price > 0 ? (
                        <PriceText amount={opt.price} weight="secondary" prefix="+" />
                      ) : (
                        <span className="text-sm font-medium text-ink-muted">Gratis</span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setOptionQty(opt.id, optQty - 1)}
                          disabled={optQty === 0}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-xl text-ink disabled:opacity-30"
                          aria-label={`Kurangi ${opt.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-base font-semibold text-ink">{optQty}</span>
                        <button
                          type="button"
                          onClick={() => setOptionQty(opt.id, optQty + 1)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-xl text-ink"
                          aria-label={`Tambah ${opt.name}`}
                        >
                          +
                        </button>
                      </span>
                    </span>
                  </div>
                  </SheetItem>
                );
              })}
            </div>
          </div>
        );
      })}

      <SheetItem index={stagger(optionIndex + 1)} className="py-3">
        <label htmlFor="notes" className="mb-1 block text-sm font-bold text-ink">
          Catatan <span className="font-normal text-ink-muted">· Opsional</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tulis permintaan khusus di sini, ya"
          rows={2}
          className="rounded-input w-full border border-border p-3 text-base"
        />
      </SheetItem>

      <SheetItem index={stagger(optionIndex + 2)} className="flex items-center justify-between py-3">
        <span className="text-sm font-bold text-ink">Jumlah pembelian</span>
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
      </SheetItem>
    </Sheet>
  );
}
