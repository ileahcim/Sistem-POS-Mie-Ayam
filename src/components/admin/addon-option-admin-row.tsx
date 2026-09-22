"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminAddonOption } from "@/lib/menu/get-menu-admin-data";
import { updateAddonOption, setAddonOptionActive } from "@/app/admin/menu/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AddonOptionAdminRow({ option }: { option: AdminAddonOption }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(option.name);
  const [priceStr, setPriceStr] = useState(String(option.price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  const price = Number(priceStr);
  const canSave = name.trim().length > 0 && Number.isFinite(price);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateAddonOption(option.id, { name, price });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    setTogglingActive(true);
    try {
      const result = await setAddonOptionActive(option.id, !option.isActive);
      if (result.ok) router.refresh();
    } finally {
      setTogglingActive(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink text-sm font-semibold">{option.name}</span>
            {!option.isActive && <Badge variant="neutral">Nonaktif</Badge>}
          </div>
          <span className="text-ink-faint text-xs">
            {option.price > 0 ? `+Rp${option.price.toLocaleString("id-ID")}` : "Gratis"}
          </span>
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Ubah
        </Button>
        <Button variant={option.isActive ? "secondary" : "primary"} disabled={togglingActive} onClick={handleToggleActive}>
          {togglingActive ? "..." : option.isActive ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0">
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Nama add-on</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-input border-border h-12 border px-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Harga tambahan</span>
        <input
          type="text"
          inputMode="numeric"
          value={priceStr}
          onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
          className="rounded-input border-border h-12 border px-3 text-base"
        />
      </label>
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(false);
            setName(option.name);
            setPriceStr(String(option.price));
            setError(null);
          }}
        >
          Batal
        </Button>
        <Button variant="primary" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
