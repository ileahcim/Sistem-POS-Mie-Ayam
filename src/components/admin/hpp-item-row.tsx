"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HppItem } from "@/lib/hpp/get-hpp-items";
import { LOW_MARGIN_THRESHOLD_PERCENT } from "@/lib/margin/config";
import { computeMarginPercent } from "@/lib/hpp/margin-math";
import { updateHppItem } from "@/app/admin/hpp/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

// One explicit "Simpan" commits costPrice + estimasi/pasti + margin tipis
// disengaja together — no separate auto-save path for the toggles, so
// there's only ever one predictable moment a row is written to the server
// (ui-ux-pro-max "Submit Feedback": loading -> success, not silent partial
// saves). The profit/margin% next to the input recomputes on every
// keystroke purely client-side — the owner is filling these in backwards
// from a known profit number, so seeing it update live as they type is the
// point (see CLAUDE.md-worthy brief this page was built from).
export function HppItemRow({ item }: { item: HppItem }) {
  const router = useRouter();
  const savedCostStr = item.costPrice != null ? String(item.costPrice) : "";
  const [costPriceStr, setCostPriceStr] = useState(savedCostStr);
  const [estimated, setEstimated] = useState(item.costPriceEstimated);
  const [intentional, setIntentional] = useState(item.marginIntentional);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = costPriceStr.trim();
  const parsedCost = trimmed === "" ? null : Number(trimmed);
  const costInvalid = trimmed !== "" && (!Number.isFinite(parsedCost) || parsedCost! < 0);
  const costMissing = parsedCost == null;
  const margin = !costMissing && !costInvalid ? item.price - parsedCost! : null;
  const marginPercent = !costMissing && !costInvalid ? computeMarginPercent(item.price, parsedCost!) : null;
  const isLowMargin = marginPercent != null && marginPercent < LOW_MARGIN_THRESHOLD_PERCENT;
  const showLowMarginWarning = isLowMargin && !intentional;

  const dirty =
    trimmed !== savedCostStr || estimated !== item.costPriceEstimated || intentional !== item.marginIntentional;

  async function handleSave() {
    if (costInvalid) {
      setError("Angka HPP tidak valid.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await updateHppItem(item.kind, item.id, {
        costPrice: parsedCost,
        costPriceEstimated: estimated,
        marginIntentional: intentional,
      });
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
        <span className="text-ink text-sm font-semibold">{item.name}</span>
        {!costMissing && !costInvalid && <Badge variant="neutral">{estimated ? "Estimasi" : "Pasti"}</Badge>}
        {costMissing && <Badge variant="warning">HPP belum diisi</Badge>}
        {showLowMarginWarning && <Badge variant="danger">Margin {marginPercent}%</Badge>}
      </div>
      <span className="text-ink-faint text-xs">Harga jual Rp{item.price.toLocaleString("id-ID")}</span>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-ink-muted">HPP Rp</span>
          <input
            type="text"
            inputMode="numeric"
            value={costPriceStr}
            onChange={(e) => setCostPriceStr(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="rounded-input border-border h-11 w-28 border px-2 text-base"
          />
        </label>
        <span className="text-ink-muted text-sm">
          {margin != null
            ? `Untung Rp${margin.toLocaleString("id-ID")}${marginPercent != null ? ` (${marginPercent}%)` : ""}`
            : "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-pill bg-muted flex h-9 items-center p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setEstimated(true)}
            className={cn("rounded-pill h-8 px-3", estimated ? "bg-surface text-ink shadow-card" : "text-ink-muted")}
          >
            Estimasi
          </button>
          <button
            type="button"
            onClick={() => setEstimated(false)}
            className={cn("rounded-pill h-8 px-3", !estimated ? "bg-surface text-ink shadow-card" : "text-ink-muted")}
          >
            Pasti
          </button>
        </div>
        <label className="text-ink flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={intentional}
            onChange={(e) => setIntentional(e.target.checked)}
            className="h-5 w-5"
          />
          Margin tipis disengaja
        </label>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      {dirty && (
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      )}
      {!dirty && savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
    </div>
  );
}
