"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MieCostKey } from "@/lib/mie/types";
import { LOW_MARGIN_THRESHOLD_PERCENT } from "@/lib/margin/config";
import { computeMarginPercent } from "@/lib/hpp/margin-math";
import { updateMieCostPerKg } from "@/app/note/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";

// "Modal per kg" of one Mi Mentah jenis, edited from /admin/hpp. Same
// Note-module data and action as /note/produk (MieProductDefault.costPerKg /
// MieSetting.pasarCostPerKg via updateMieCostPerKg) — the admin page just
// exposes it next to the warung's HPP rows, it does not own a second copy.
// Mirrors hpp-item-row.tsx's layout: inline input + live "Untung Rp(x/kg) (%)"
// computed from the jenis's default sale price, and one always-visible Simpan.
export function MieCostAdminRow({
  costKey,
  label,
  costPerKg,
  salePricePerKg,
}: {
  costKey: MieCostKey;
  label: string;
  costPerKg: number | null;
  salePricePerKg: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number | "">(costPerKg ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costInvalid = value !== "" && (!Number.isFinite(value) || Number(value) <= 0);
  const costMissing = costPerKg == null && value === "";
  const margin = salePricePerKg != null && value !== "" && !costInvalid ? salePricePerKg - Number(value) : null;
  const marginPercent =
    salePricePerKg != null && value !== "" && !costInvalid ? computeMarginPercent(salePricePerKg, Number(value)) : null;
  const showLowMarginWarning = marginPercent != null && marginPercent < LOW_MARGIN_THRESHOLD_PERCENT;

  const dirty = value !== (costPerKg ?? "");

  async function handleSave() {
    if (value === "" || Number(value) <= 0) {
      setError("Modal tidak valid.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await updateMieCostPerKg(costKey, Number(value));
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
    <div className="flex flex-col gap-2 border-border border-b p-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-ink text-sm font-semibold">{label}</span>
        {costMissing && <Badge variant="warning">Modal belum diisi</Badge>}
        {showLowMarginWarning && <Badge variant="danger">Margin {marginPercent}%</Badge>}
      </div>
      <span className="text-ink-faint text-xs">
        {salePricePerKg != null
          ? `Harga jual default Rp${salePricePerKg.toLocaleString("id-ID")}/kg`
          : "Harga jual default belum diisi"}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-ink-muted">Modal Rp</span>
          <RupiahInput value={value} onChange={setValue} placeholder="0" className="h-11 w-32 text-base" />
          <span className="text-ink-muted">/kg</span>
        </label>
        <span className="text-ink-muted text-sm">
          {salePricePerKg == null
            ? "—"
            : margin != null
              ? `Untung Rp${margin.toLocaleString("id-ID")}/kg${marginPercent != null ? ` (${marginPercent}%)` : ""}`
              : "—"}
        </span>
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
