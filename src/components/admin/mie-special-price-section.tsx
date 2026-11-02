"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { MieSpecialPriceRow } from "@/lib/mie/get-mie-customer-prices";
import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PRODUCT_LABEL, type MieProductType } from "@/lib/mie/types";
import { setMieCustomerPrices } from "@/app/note/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";

type Jenis = Exclude<MieProductType, "CUSTOM">;
type Editing = { mode: "add" } | { mode: "edit"; row: MieSpecialPriceRow };

// "Harga Khusus Pelanggan" (2 Nov 2026) — every customer's own Rp/kg in one
// list, under the default prices. Same MieCustomerPrice rows and the same
// action (setMieCustomerPrices, OWNER only) as the "Harga khusus" sheet on
// the customer's Note page — one source, edited from two places. Pesanan
// Baru suggests a customer's harga khusus first, else the default. Mi Pasar
// has no per-customer price (always its own default), so it isn't a choice.
export function MieSpecialPriceSection({
  rows,
  customers,
  defaults,
}: {
  rows: MieSpecialPriceRow[];
  customers: { id: string; name: string }[]; // active, for "+ Tambah"
  defaults: MieProductDefaults;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<MieSpecialPriceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    const result = await setMieCustomerPrices(deleting.customerId, [
      { productType: deleting.productType, pricePerKg: null },
    ]);
    setBusy(false);
    if (!result.ok) return setDeleteError(result.error);
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1" data-testid="special-price-section">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-ink-muted text-sm font-bold uppercase tracking-wide">Harga Khusus Pelanggan</h3>
          <p className="text-ink-muted text-sm">
            Dipakai otomatis di Pesanan Baru untuk pelanggan itu. Pelanggan tanpa harga khusus ikut harga default di
            atas. Pesanan yang sudah tercatat tidak berubah.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ mode: "add" })} disabled={customers.length === 0}>
          + Tambah
        </Button>
      </div>
      <Card>
        {rows.length === 0 ? (
          <p className="text-ink-faint px-3 py-4 text-sm">Belum ada pelanggan dengan harga khusus.</p>
        ) : (
          rows.map((row) => {
            const def = defaults[row.productType];
            return (
              <div
                key={`${row.customerId}-${row.productType}`}
                data-testid="special-price-row"
                className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 basis-40 flex-col">
                  <span className="text-ink flex flex-wrap items-center gap-1.5 text-base font-semibold">
                    {row.customerName}
                    {!row.isActive && <Badge variant="neutral">Nonaktif</Badge>}
                  </span>
                  <span className="text-ink-muted text-sm">{MIE_PRODUCT_LABEL[row.productType]}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-ink text-base font-bold tabular-nums">
                    Rp{row.pricePerKg.toLocaleString("id-ID")}/kg
                  </span>
                  {def != null && def !== row.pricePerKg && (
                    <span className="text-ink-faint text-xs tabular-nums">default Rp{def.toLocaleString("id-ID")}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="compact" onClick={() => setEditing({ mode: "edit", row })}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="compact"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(row);
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <AnimatePresence>
        {editing && (
          <SpecialPriceEditSheet
            key={editing.mode === "edit" ? `${editing.row.customerId}-${editing.row.productType}` : "add"}
            editing={editing}
            rows={rows}
            customers={customers}
            defaults={defaults}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      {deleting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true">
          <div className="rounded-card bg-surface shadow-sheet flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
            <div>
              <p className="text-ink text-lg font-bold">Hapus harga khusus?</p>
              <p className="text-ink-muted mt-1 text-sm">
                {deleting.customerName} · {MIE_PRODUCT_LABEL[deleting.productType]} Rp
                {deleting.pricePerKg.toLocaleString("id-ID")}/kg. Pesanan berikutnya ikut harga default
                {defaults[deleting.productType] != null
                  ? ` Rp${defaults[deleting.productType]!.toLocaleString("id-ID")}/kg`
                  : ""}
                . Pesanan lama tidak berubah.
              </p>
            </div>
            {deleteError && <p className="text-danger text-sm">{deleteError}</p>}
            <div className="flex w-full flex-col gap-2">
              <Button variant="danger" size="large" fullWidth disabled={busy} onClick={handleDelete}>
                {busy ? "Menghapus..." : "Ya, Hapus"}
              </Button>
              <Button variant="secondary" fullWidth disabled={busy} onClick={() => setDeleting(null)}>
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecialPriceEditSheet({
  editing,
  rows,
  customers,
  defaults,
  onClose,
}: {
  editing: Editing;
  rows: MieSpecialPriceRow[];
  customers: { id: string; name: string }[];
  defaults: MieProductDefaults;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = editing.mode === "edit";
  const [customerId, setCustomerId] = useState(isEdit ? editing.row.customerId : (customers[0]?.id ?? ""));
  const [jenis, setJenis] = useState<Jenis>(isEdit ? editing.row.productType : "MIE_KERITING");
  const [price, setPrice] = useState<number | "">(isEdit ? editing.row.pricePerKg : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adding a pair that already has a price replaces it — say so up front.
  const existing = !isEdit ? rows.find((r) => r.customerId === customerId && r.productType === jenis) : undefined;
  const def = defaults[jenis];
  const canSave = !saving && customerId !== "" && price !== "" && Number(price) > 0;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setMieCustomerPrices(customerId, [{ productType: jenis, pricePerKg: Number(price) }]);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Sheet
      title={isEdit ? `Ubah harga khusus ${editing.row.customerName}` : "Tambah harga khusus"}
      onClose={onClose}
      footer={
        <Button variant="primary" size="large" fullWidth disabled={!canSave} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <div className="mx-auto flex max-w-md flex-col gap-3">
        {isEdit ? (
          <p className="text-ink text-base">
            <span className="font-semibold">{editing.row.customerName}</span> · {MIE_PRODUCT_LABEL[jenis]}
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Pelanggan</span>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Jenis mi</span>
              <div className="flex flex-wrap gap-2">
                {MIE_FIXED_PRODUCT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setJenis(t)}
                    aria-pressed={jenis === t}
                    className={cn(
                      "rounded-pill h-12 px-4 text-sm font-semibold",
                      jenis === t ? "bg-primary text-white" : "bg-muted text-ink-muted",
                    )}
                  >
                    {MIE_PRODUCT_LABEL[t]}
                  </button>
                ))}
              </div>
              <span className="text-ink-faint text-xs">Mi Pasar tidak punya harga khusus — selalu harga default Mi Pasar.</span>
            </div>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-ink-muted text-sm font-medium">Harga per kg</span>
          <RupiahInput
            value={price}
            onChange={(v) => setPrice(v > 0 ? v : "")}
            placeholder={def != null ? def.toLocaleString("id-ID") : "0"}
            className="h-12 text-base"
          />
          <span className="text-ink-faint text-xs">
            {def != null ? `Harga default Rp${def.toLocaleString("id-ID")}/kg` : "Harga default belum diisi"}
          </span>
        </label>
        {existing && (
          <p className="bg-warning-soft text-warning rounded-card px-3 py-2 text-sm font-medium">
            Sudah ada harga khusus Rp{existing.pricePerKg.toLocaleString("id-ID")}/kg — akan diganti.
          </p>
        )}
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}
