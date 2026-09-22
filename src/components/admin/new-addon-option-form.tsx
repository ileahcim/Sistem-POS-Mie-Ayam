"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAddonOption } from "@/app/admin/menu/actions";
import { Button } from "@/components/ui/button";

export function NewAddonOptionForm({ addonGroupId }: { addonGroupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = Number(priceStr);
  const canSave = name.trim().length > 0 && Number.isFinite(price);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await createAddonOption({ addonGroupId, name, price });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setPriceStr("");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="p-3">
        <Button variant="ghost" size="default" fullWidth onClick={() => setOpen(true)}>
          + Tambah Opsi
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama add-on"
        className="rounded-input border-border h-12 border px-3 text-base"
      />
      <input
        type="text"
        inputMode="numeric"
        value={priceStr}
        onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="Harga tambahan (0 = gratis)"
        className="rounded-input border-border h-12 border px-3 text-base"
      />
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setName("");
            setPriceStr("");
            setError(null);
            setOpen(false);
          }}
        >
          Batal
        </Button>
        <Button variant="primary" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Tambah"}
        </Button>
      </div>
    </div>
  );
}
