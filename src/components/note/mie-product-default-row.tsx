"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MieCostKey, MieProductType } from "@/lib/mie/types";
import { updateMieCostPerKg, updateMiePasarPrice, updateMieProductDefault } from "@/app/note/actions";
import { updateFrozenPrice } from "@/app/note/frozen-actions";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// One explicit Simpan per row, same pattern as hpp-item-row.tsx — no silent
// auto-save. Never seeded/guessed (see MieProductDefault in schema.prisma),
// so a null defaultPricePerKg shows the same "belum diisi" badge as an
// unfilled Product.costPrice elsewhere in the app.
// `target` picks what the row saves: a product's default price, or the
// "Mie Pasar" shortcut price (MieSetting), or a "Modal per kg" (cost, not a
// sale price — the badge says "Modal belum diisi", same pattern as the POS
// "HPP belum diisi") — same editor for all.
export function MieProductDefaultRow({
  target,
  label,
  hint,
  defaultPricePerKg,
}: {
  target:
    | { kind: "default"; productType: Exclude<MieProductType, "CUSTOM"> }
    | { kind: "pasar" }
    | { kind: "frozenPrice" }
    | { kind: "cost"; key: MieCostKey };
  label: string;
  hint?: string;
  defaultPricePerKg: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number | "">(defaultPricePerKg ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== (defaultPricePerKg ?? "");

  async function handleSave() {
    if (value === "" || Number(value) <= 0) {
      setError("Harga tidak valid.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result =
        target.kind === "pasar"
          ? await updateMiePasarPrice(Number(value))
          : target.kind === "frozenPrice"
            ? await updateFrozenPrice(Number(value))
            : target.kind === "cost"
              ? await updateMieCostPerKg(target.key, Number(value))
              : await updateMieProductDefault(target.productType, Number(value));
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
      <div className="flex items-center gap-1.5">
        <span className="text-ink text-sm font-semibold">{label}</span>
        {defaultPricePerKg == null && (
          <Badge variant="warning">{target.kind === "cost" ? "Modal belum diisi" : "Belum diisi"}</Badge>
        )}
      </div>
      {hint && <p className="text-ink-muted -mt-1 text-xs">{hint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <RupiahInput value={value} onChange={setValue} placeholder="0" className="h-11 w-40 text-base" />
        <span className="text-ink-muted text-sm">/ {target.kind === "frozenPrice" ? "pcs" : "kg"}</span>
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
