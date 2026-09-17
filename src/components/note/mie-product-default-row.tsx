"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MieProductType } from "@/lib/mie/types";
import { updateMieProductDefault } from "@/app/note/actions";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// One explicit Simpan per row, same pattern as hpp-item-row.tsx — no silent
// auto-save. Never seeded/guessed (see MieProductDefault in schema.prisma),
// so a null defaultPricePerKg shows the same "belum diisi" badge as an
// unfilled Product.costPrice elsewhere in the app.
export function MieProductDefaultRow({
  productType,
  label,
  defaultPricePerKg,
}: {
  productType: Exclude<MieProductType, "CUSTOM">;
  label: string;
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
      const result = await updateMieProductDefault(productType, Number(value));
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
        {defaultPricePerKg == null && <Badge variant="warning">Belum diisi</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RupiahInput value={value} onChange={setValue} placeholder="0" className="h-11 w-40 text-base" />
        <span className="text-ink-muted text-sm">/ kg</span>
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
