"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/app/admin/menu/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NewProductForm({
  categories,
  addonGroups,
}: {
  categories: { id: string; name: string }[];
  addonGroups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = Number(priceStr);
  const canSave = name.trim().length > 0 && Number.isFinite(price) && price >= 0 && !!categoryId;

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function reset() {
    setName("");
    setPriceStr("");
    setSelectedGroupIds([]);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await createProduct({ name, price, categoryId, addonGroupIds: selectedGroupIds });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="default" fullWidth onClick={() => setOpen(true)}>
        + Tambah Produk
      </Button>
    );
  }

  return (
    <Card padded className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Nama produk</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Mie Ayam Jumbo"
          className="rounded-input border-border h-12 border px-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Harga</span>
        <input
          type="text"
          inputMode="numeric"
          value={priceStr}
          onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="0"
          className="rounded-input border-border h-12 border px-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Kategori</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-input border-border h-12 border px-3 text-base"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {addonGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-ink-muted text-sm font-medium">Grup add-on (opsional)</span>
          <div className="flex flex-col gap-1">
            {addonGroups.map((g) => (
              <label key={g.id} className="text-ink flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                  className="h-5 w-5"
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Batal
        </Button>
        <Button variant="primary" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Tambah Produk"}
        </Button>
      </div>
    </Card>
  );
}
