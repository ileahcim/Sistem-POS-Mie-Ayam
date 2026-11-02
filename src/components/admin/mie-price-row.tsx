"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MieCostKey, MieProductType } from "@/lib/mie/types";
import { LOW_MARGIN_THRESHOLD_PERCENT } from "@/lib/margin/config";
import { computeMarginPercent } from "@/lib/hpp/margin-math";
import { updateMieCostPerKg, updateMiePasarPrice, updateMieProductDefault } from "@/app/note/actions";
import { updateFrozenPrice } from "@/app/note/frozen-actions";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// The ONE editor row for every Note price/cost number (2 Nov 2026 — replaces
// MieProductDefaultRow + MieCostAdminRow, which did the same job twice):
//   - Manajemen Menu → "Mi Mentah": default Rp/kg per jenis, Mi Pasar, and
//     the Frozen Rp/pcs (sale prices);
//   - Isi HPP → "Mi Mentah": Modal per kg (cost) — with `salePricePerKg`
//     the row also shows the live "Untung Rp…/kg (x%)" against that jenis's
//     default sale price, and the low-margin badge.
// One explicit Simpan per row, always visible (disabled until changed) —
// no silent auto-save. A null value is never guessed: it shows "Belum diisi"
// ("Modal belum diisi" for a cost), same rule as Product.costPrice.
export type MiePriceTarget =
  | { kind: "default"; productType: Exclude<MieProductType, "CUSTOM"> }
  | { kind: "pasar" }
  | { kind: "frozenPrice" }
  | { kind: "cost"; key: MieCostKey };

export function MiePriceRow({
  target,
  label,
  hint,
  value: savedValue,
  salePricePerKg,
}: {
  target: MiePriceTarget;
  label: string;
  hint?: string;
  value: number | null;
  // Cost rows only: the jenis's default sale price, the basis of "Untung".
  salePricePerKg?: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number | "">(savedValue ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCost = target.kind === "cost";
  const dirty = value !== (savedValue ?? "");
  const valid = value !== "" && Number(value) > 0;
  const showMargin = isCost && salePricePerKg !== undefined;
  const margin = showMargin && salePricePerKg != null && valid ? salePricePerKg - Number(value) : null;
  const marginPercent =
    showMargin && salePricePerKg != null && valid ? computeMarginPercent(salePricePerKg, Number(value)) : null;

  async function handleSave() {
    if (!valid) {
      setError(isCost ? "Modal tidak valid." : "Harga tidak valid.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const n = Number(value);
      const result =
        target.kind === "pasar"
          ? await updateMiePasarPrice(n)
          : target.kind === "frozenPrice"
            ? await updateFrozenPrice(n)
            : target.kind === "cost"
              ? await updateMieCostPerKg(target.key, n)
              : await updateMieProductDefault(target.productType, n);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-border flex flex-col gap-2 border-b p-3 last:border-b-0" data-testid="mie-price-row">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-ink text-sm font-semibold">{label}</span>
        {savedValue == null && value === "" && (
          <Badge variant="warning">{isCost ? "Modal belum diisi" : "Belum diisi"}</Badge>
        )}
        {marginPercent != null && marginPercent < LOW_MARGIN_THRESHOLD_PERCENT && (
          <Badge variant="danger">Margin {marginPercent}%</Badge>
        )}
      </div>
      {hint && <p className="text-ink-muted -mt-1 text-xs">{hint}</p>}
      {showMargin && (
        <span className="text-ink-faint -mt-1 text-xs">
          {salePricePerKg != null
            ? `Harga jual default Rp${salePricePerKg.toLocaleString("id-ID")}/kg`
            : "Harga jual default belum diisi"}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm">
          {isCost && <span className="text-ink-muted">Modal Rp</span>}
          <RupiahInput value={value} onChange={setValue} placeholder="0" className="h-12 w-36 text-base" />
          <span className="text-ink-muted">/ {target.kind === "frozenPrice" ? "pcs" : "kg"}</span>
        </label>
        {showMargin && (
          <span className="text-ink-muted text-sm">
            {margin != null
              ? `Untung Rp${margin.toLocaleString("id-ID")}/kg${marginPercent != null ? ` (${marginPercent}%)` : ""}`
              : "—"}
          </span>
        )}
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
        {!dirty && savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
      </div>
    </div>
  );
}
