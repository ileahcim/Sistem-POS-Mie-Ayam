"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";
import { formatRupiah } from "@/lib/printing/format";
import { CORRECTION_REASONS, unitCostFromBox } from "@/lib/stock/types";
import type { IceCreamProduct } from "@/lib/stock/get-ice-cream";
import {
  createIceCreamProduct,
  recordCorrection,
  recordRestock,
  setIceCreamActive,
  updateIceCreamProduct,
  type ActionResult,
} from "@/app/es-krim/actions";

// OWNER sheets of the Stok Es Krim page (docs/spec-es-krim.md). Every action
// re-checks the role on the server (requireRole("OWNER") first line).

type Done = (message: string) => void;

function useSubmit(onDone: Done) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(action: () => Promise<ActionResult>, message: string) {
    setSaving(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(message);
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, submit };
}

function digitsOnly(raw: string): number | "" {
  const d = raw.replace(/\D/g, "");
  return d ? Number(d) : "";
}

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
}: {
  id: string;
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  suffix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-ink mb-1 block text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
          className="rounded-input border-border h-12 w-full border px-3 pr-14 text-lg"
        />
        {suffix && (
          <span className="text-ink-muted pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ProductPicker({
  products,
  selectedId,
  onPick,
}: {
  products: IceCreamProduct[];
  selectedId: string | null;
  onPick: (p: IceCreamProduct) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {products.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          aria-pressed={p.id === selectedId}
          className={cn(
            "rounded-card flex min-h-16 flex-col items-start justify-center border px-3 py-2 text-left",
            p.id === selectedId ? "border-primary bg-primary-soft" : "border-border bg-surface",
          )}
        >
          <span className="text-ink text-sm leading-tight font-bold">{p.name}</span>
          <span className="text-ink-muted text-xs">stok {p.stock}</span>
        </button>
      ))}
    </div>
  );
}

// "Barang Masuk": boxes × isi into stock; modal per pcs follows this box price.
export function RestockSheet({ products, onClose, onDone }: { products: IceCreamProduct[]; onClose: () => void; onDone: Done }) {
  const [product, setProduct] = useState<IceCreamProduct | null>(null);
  const [boxes, setBoxes] = useState(1);
  const [unitsPerBox, setUnitsPerBox] = useState<number | "">("");
  const [boxPrice, setBoxPrice] = useState<number | "">("");
  const { saving, error, submit } = useSubmit(onDone);

  function pick(p: IceCreamProduct) {
    setProduct(p);
    setBoxes(1);
    setUnitsPerBox(p.unitsPerBox ?? "");
    setBoxPrice(p.boxPrice ?? "");
  }

  const valid = !!product && unitsPerBox !== "" && unitsPerBox > 0 && boxPrice !== "" && boxPrice > 0;
  const pcs = valid ? boxes * (unitsPerBox as number) : 0;

  return (
    <Sheet
      title="Barang Masuk"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button
            variant="primary"
            size="large"
            fullWidth
            disabled={!valid || saving}
            onClick={() =>
              product &&
              submit(
                () => recordRestock({ productId: product.id, boxes, unitsPerBox: unitsPerBox as number, boxPrice: boxPrice as number }),
                `Barang masuk: ${product.name} +${pcs} pcs.`,
              )
            }
          >
            {saving ? "Menyimpan..." : valid ? `Simpan — stok +${pcs} pcs` : "Lengkapi isian dulu"}
          </Button>
        </div>
      }
    >
      <p className="text-ink mb-2 text-sm font-bold">Produk</p>
      <ProductPicker products={products} selectedId={product?.id ?? null} onPick={pick} />
      {product && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink text-sm font-bold">Jumlah box</span>
            <QtyStepper
              qty={boxes}
              label="box"
              onDecrement={() => setBoxes((b) => Math.max(1, b - 1))}
              onIncrement={() => setBoxes((b) => b + 1)}
              decrementDisabled={boxes <= 1}
            />
          </div>
          <NumberField id="restock-units" label="Isi per box" value={unitsPerBox} onChange={setUnitsPerBox} suffix="pcs" />
          <div>
            <label htmlFor="restock-price" className="text-ink mb-1 block text-sm font-bold">
              Harga beli per box
            </label>
            <RupiahInput id="restock-price" value={boxPrice} onChange={(v) => setBoxPrice(v || "")} className="h-12" />
          </div>
          {valid && (
            <p className="bg-muted rounded-input text-ink px-3 py-2 text-sm">
              Stok {product.stock} → <b>{product.stock + pcs}</b> pcs · Modal per pcs jadi{" "}
              <b>{formatRupiah(unitCostFromBox(boxPrice as number, unitsPerBox as number))}</b>
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

// "Koreksi Stok": manual +/−, reason required.
export function CorrectionSheet({ products, onClose, onDone }: { products: IceCreamProduct[]; onClose: () => void; onDone: Done }) {
  const [product, setProduct] = useState<IceCreamProduct | null>(null);
  const [direction, setDirection] = useState<"minus" | "plus">("minus");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const { saving, error, submit } = useSubmit(onDone);

  const maxMinus = product?.stock ?? 0;
  const delta = direction === "minus" ? -qty : qty;
  const valid = !!product && !!reason.trim() && (direction === "plus" || qty <= maxMinus);

  return (
    <Sheet
      title="Koreksi Stok"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button
            variant="primary"
            size="large"
            fullWidth
            disabled={!valid || saving}
            onClick={() =>
              product &&
              submit(
                () => recordCorrection({ productId: product.id, delta, reason }),
                `Koreksi: ${product.name} ${delta > 0 ? "+" : ""}${delta} pcs.`,
              )
            }
          >
            {saving ? "Menyimpan..." : !product ? "Pilih produk dulu" : !reason.trim() ? "Isi alasan dulu" : `Simpan koreksi ${delta > 0 ? "+" : ""}${delta} pcs`}
          </Button>
        </div>
      }
    >
      <p className="text-ink mb-2 text-sm font-bold">Produk</p>
      <ProductPicker
        products={products}
        selectedId={product?.id ?? null}
        onPick={(p) => {
          setProduct(p);
          setQty(1);
          if (p.stock === 0) setDirection("plus");
        }}
      />
      {product && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["minus", "plus"] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={d === "minus" && product.stock === 0}
                onClick={() => {
                  setDirection(d);
                  setQty(1);
                }}
                aria-pressed={direction === d}
                className={cn(
                  "rounded-pill h-12 border text-base font-semibold disabled:opacity-40",
                  direction === d ? "border-primary bg-primary-soft text-primary-strong" : "border-border text-ink",
                )}
              >
                {d === "minus" ? "− Kurangi" : "+ Tambah"}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink text-sm font-bold">Jumlah (pcs)</span>
            <QtyStepper
              qty={qty}
              label="pcs"
              onDecrement={() => setQty((q) => Math.max(1, q - 1))}
              onIncrement={() => setQty((q) => (direction === "minus" ? Math.min(maxMinus, q + 1) : q + 1))}
              decrementDisabled={qty <= 1}
              incrementDisabled={direction === "minus" && qty >= maxMinus}
            />
          </div>
          <p className="text-ink-muted text-sm">
            Stok {product.stock} → <b className="text-ink">{product.stock + delta}</b> pcs
          </p>
          <div>
            <p className="text-ink mb-2 text-sm font-bold">Alasan (wajib)</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {CORRECTION_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-pill h-12 border px-4 text-sm font-semibold",
                    reason === r ? "border-primary bg-primary-soft text-primary-strong" : "border-border text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              aria-label="Alasan lain"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="atau tulis alasan lain"
              maxLength={100}
              className="rounded-input border-border h-12 w-full border px-3 text-base"
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}

// Tambah / Edit produk es krim. Stock is never typed here — it only comes in
// through Barang Masuk (so it always has a history row).
export function ProductFormSheet({
  product,
  onClose,
  onDone,
}: {
  product: IceCreamProduct | null; // null = new product
  onClose: () => void;
  onDone: Done;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState<number | "">(product?.price ?? "");
  const [unitsPerBox, setUnitsPerBox] = useState<number | "">(product?.unitsPerBox ?? "");
  const [boxPrice, setBoxPrice] = useState<number | "">(product?.boxPrice ?? "");
  const { saving, error, submit } = useSubmit(onDone);

  const valid = !!name.trim() && price !== "" && price > 0 && unitsPerBox !== "" && unitsPerBox > 0 && boxPrice !== "" && boxPrice > 0;
  const input = () => ({ name, price: price as number, unitsPerBox: unitsPerBox as number, boxPrice: boxPrice as number });

  return (
    <Sheet
      title={product ? `Edit ${product.name}` : "Produk Es Krim Baru"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button
            variant="primary"
            size="large"
            fullWidth
            disabled={!valid || saving}
            onClick={() =>
              product
                ? submit(() => updateIceCreamProduct(product.id, input()), `${name.trim()} tersimpan.`)
                : submit(() => createIceCreamProduct(input()), `${name.trim()} ditambahkan (stok 0 — isi lewat Barang Masuk).`)
            }
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          {product && (
            <Button
              variant={product.isActive ? "danger" : "secondary"}
              size="default"
              fullWidth
              disabled={saving}
              onClick={() =>
                submit(
                  () => setIceCreamActive(product.id, !product.isActive),
                  product.isActive ? `${product.name} dinonaktifkan.` : `${product.name} diaktifkan lagi.`,
                )
              }
            >
              {product.isActive ? "Nonaktifkan (sembunyikan dari Kasir)" : "Aktifkan lagi"}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="ice-name" className="text-ink mb-1 block text-sm font-bold">
            Nama
          </label>
          <input
            id="ice-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Jumbo Cup Coklat"
            maxLength={60}
            className="rounded-input border-border h-12 w-full border px-3 text-base"
          />
        </div>
        <div>
          <label htmlFor="ice-price" className="text-ink mb-1 block text-sm font-bold">
            Harga jual per pcs
          </label>
          <RupiahInput id="ice-price" value={price} onChange={(v) => setPrice(v || "")} className="h-12" />
        </div>
        <NumberField id="ice-units" label="Isi per box" value={unitsPerBox} onChange={setUnitsPerBox} suffix="pcs" />
        <div>
          <label htmlFor="ice-box-price" className="text-ink mb-1 block text-sm font-bold">
            Harga beli per box
          </label>
          <RupiahInput id="ice-box-price" value={boxPrice} onChange={(v) => setBoxPrice(v || "")} className="h-12" />
        </div>
        {unitsPerBox !== "" && unitsPerBox > 0 && boxPrice !== "" && boxPrice > 0 && (
          <p className="bg-muted rounded-input text-ink px-3 py-2 text-sm">
            Modal per pcs: <b>{formatRupiah(unitCostFromBox(boxPrice, unitsPerBox))}</b>
            {price !== "" && price > 0 && (
              <> · Untung per pcs: <b>{formatRupiah(price - unitCostFromBox(boxPrice, unitsPerBox))}</b></>
            )}
          </p>
        )}
        {!product && <p className="text-ink-muted text-sm">Stok mulai dari 0. Isi stok lewat Barang Masuk.</p>}
      </div>
    </Sheet>
  );
}
