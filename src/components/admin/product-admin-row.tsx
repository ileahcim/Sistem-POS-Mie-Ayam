"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct } from "@/lib/menu/get-menu-admin-data";
import { updateProduct, setProductActive } from "@/app/admin/menu/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Mirrors hpp-item-row.tsx's pattern: inline edit fields, one explicit
// Simpan, no silent auto-save. Scope here is catalog structure only (name,
// price, category, which add-on groups apply) — costPrice/margin stay on
// /admin/hpp, so a field only ever has one place it's edited.
export function ProductAdminRow({
  product,
  categories,
  addonGroups,
}: {
  product: AdminProduct;
  categories: { id: string; name: string }[];
  addonGroups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [priceStr, setPriceStr] = useState(String(product.price));
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(product.addonGroupIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  const price = Number(priceStr);
  const canSave = name.trim().length > 0 && Number.isFinite(price) && price >= 0;

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateProduct(product.id, {
        name,
        price,
        categoryId,
        addonGroupIds: selectedGroupIds,
      });
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
      const result = await setProductActive(product.id, !product.isActive);
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
            <span className="text-ink text-sm font-semibold">{product.name}</span>
            {!product.isActive && <Badge variant="neutral">Nonaktif</Badge>}
          </div>
          <span className="text-ink-faint text-xs">Rp{product.price.toLocaleString("id-ID")}</span>
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Ubah
        </Button>
        <Button variant={product.isActive ? "secondary" : "primary"} disabled={togglingActive} onClick={handleToggleActive}>
          {togglingActive ? "..." : product.isActive ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0">
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted text-sm font-medium">Nama produk</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          <span className="text-ink-muted text-sm font-medium">Grup add-on</span>
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
            setEditing(false);
            setName(product.name);
            setPriceStr(String(product.price));
            setCategoryId(product.categoryId);
            setSelectedGroupIds(product.addonGroupIds);
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
