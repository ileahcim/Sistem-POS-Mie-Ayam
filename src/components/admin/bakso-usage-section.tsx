"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BaksoUsageSettingValues } from "@/lib/dashboard/bakso-usage";
import { updateBaksoUsageSetting, type BaksoUsageSettingInput } from "@/app/admin/menu/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FIELDS: { key: keyof BaksoUsageSettingInput; label: string }[] = [
  { key: "baksoPolosKecil", label: "Bakso polos (tanpa upgrade) — kecil" },
  { key: "baksoUratKecil", label: "Bakso + Urat — kecil" },
  { key: "baksoUratUrat", label: "Bakso + Urat — urat" },
  { key: "baksoTelurKecil", label: "Bakso + Telur — kecil" },
  { key: "baksoTelurTelur", label: "Bakso + Telur — telur" },
  { key: "toppingBaksoKecil", label: "Topping “Bakso” (Mie Ayam/Pangsit Rebus/Ceker) — kecil" },
  { key: "toppingBaksoUratUrat", label: "Topping “Bakso Urat” — urat" },
  { key: "toppingBaksoTelurTelur", label: "Topping “Bakso Telur” — telur" },
  { key: "baksoKecilProdukKecil", label: "Bakso Kecil (3 biji) — kecil" },
  { key: "baksoSetengahKecil", label: "Bakso Setengah (4 biji) — kecil" },
  { key: "baksoUratBijianUrat", label: "Bakso Urat (bijian) — urat, per qty" },
  { key: "baksoTelurBijianTelur", label: "Bakso Telur (bijian) — telur, per qty" },
];

function toValues(input: Record<string, string>): BaksoUsageSettingInput {
  const out = {} as BaksoUsageSettingInput;
  for (const f of FIELDS) out[f.key] = Number(input[f.key]) || 0;
  return out;
}

// "Perkiraan Bakso Terpakai" — the recipe numbers behind Dashboard's bakso
// estimate, editable here instead of hardcoded (CLAUDE.md, 24 Sep 2026).
// One save for all 12 fields at once (not per-row auto-save like HPP) —
// they're read together as one recipe, so a half-saved state mid-edit would
// be confusing to leave live on the Dashboard.
export function BaksoUsageSettingsForm({ initial }: { initial: BaksoUsageSettingValues }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(initial[f.key])])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateBaksoUsageSetting(toValues(values));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-ink text-base font-bold">Perkiraan Bakso Terpakai</h2>
      <p className="text-ink-muted text-sm">
        Angka bakso (kecil/urat/telur) per item, dipakai Dashboard untuk memperkirakan bakso terpakai. Cuma perkiraan —
        bukan sistem stok.
      </p>
      <Card padded className="flex flex-col gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink flex-1">{f.label}</span>
            <input
              type="text"
              inputMode="numeric"
              value={values[f.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d]/g, "") }))
              }
              className="rounded-input border-border h-11 w-20 border px-2 text-center text-base"
            />
          </label>
        ))}
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button variant="primary" size="large" fullWidth disabled={saving} onClick={handleSave}>
          {saving ? "Menyimpan..." : saved ? "Tersimpan ✓" : "Simpan"}
        </Button>
      </Card>
    </section>
  );
}
