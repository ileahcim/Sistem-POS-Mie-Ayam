"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import type { MieProductType } from "@/lib/mie/types";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import { createMieOrder, getMieAutofillPrice } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { cn } from "@/components/ui/cn";
import { todayDateStr, dateInputToIso } from "@/lib/mie/date-input";

export function NewOrderForm({
  customers,
  initialCustomerId,
  orderAktifIndicator,
}: {
  customers: MieCustomerRow[];
  initialCustomerId?: string;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? customers[0]?.id ?? "");
  const [productType, setProductType] = useState<MieProductType>("MIE_KERITING");
  const [customLabel, setCustomLabel] = useState("");
  const [kg, setKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState<number | "">("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autofill: this customer's last price for this product, else the
  // product's owner-set default (see getMieAutofillPrice) — never for
  // CUSTOM, which is always priced fresh. Only overwrites the field while
  // the owner hasn't typed their own number for this customer/product pair.
  useEffect(() => {
    if (productType === "CUSTOM" || !customerId || priceManuallyEdited) return;
    let cancelled = false;
    getMieAutofillPrice(customerId, productType).then((price) => {
      if (!cancelled && price != null) setPricePerKg(price);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, productType]);

  function handleProductTypeChange(next: MieProductType) {
    setProductType(next);
    setPriceManuallyEdited(false);
    if (next === "CUSTOM") setPricePerKg("");
  }

  const kgNumber = Number(kg.replace(",", "."));
  const kgValid = kg.trim() !== "" && Number.isFinite(kgNumber) && kgNumber > 0;
  const canSave =
    !saving &&
    customerId &&
    kgValid &&
    pricePerKg !== "" &&
    Number(pricePerKg) > 0 &&
    (productType !== "CUSTOM" || customLabel.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createMieOrder({
      customerId,
      productType,
      customLabel,
      kg: kgNumber,
      pricePerKg: Number(pricePerKg),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(`/note/pelanggan/${customerId}`);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Pesanan Baru</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton activeCount={orderAktifIndicator.activeCount} lateCount={orderAktifIndicator.lateCount} />
          <LinkButton href="/note" variant="secondary">
            Batal
          </LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Card padded className="flex flex-col gap-3">
            {customers.length === 0 ? (
              <p className="text-ink-muted text-sm">
                Belum ada pelanggan.{" "}
                <Link href="/note/pelanggan/baru" className="text-primary font-semibold underline">
                  Tambah pelanggan
                </Link>{" "}
                dulu.
              </p>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Pelanggan</span>
                <select
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setPriceManuallyEdited(false);
                  }}
                  className="rounded-input border-border h-12 border px-3 text-base"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Jenis mi</span>
              <div className="flex flex-wrap gap-2">
                {MIE_FIXED_PRODUCT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleProductTypeChange(type)}
                    className={cn(
                      "rounded-pill h-11 px-4 text-sm font-semibold",
                      productType === type ? "bg-primary text-white" : "bg-muted text-ink-muted",
                    )}
                  >
                    {MIE_PRODUCT_LABEL[type]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleProductTypeChange("CUSTOM")}
                  className={cn(
                    "rounded-pill h-11 px-4 text-sm font-semibold",
                    productType === "CUSTOM" ? "bg-primary text-white" : "bg-muted text-ink-muted",
                  )}
                >
                  Custom
                </button>
              </div>
            </div>

            {productType === "CUSTOM" && (
              <label className="flex flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Nama jenis mi (request khusus)</span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Mis. Mi Kuning Tebal"
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
            )}

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Jumlah (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kg}
                  onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0"
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ink-muted text-sm font-medium">Harga/kg</span>
                <RupiahInput
                  value={pricePerKg}
                  onChange={(v) => {
                    setPricePerKg(v);
                    setPriceManuallyEdited(true);
                  }}
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
            </div>

            {kgValid && pricePerKg !== "" && (
              <p className="text-ink-muted text-sm">
                Total: Rp{Math.round(kgNumber * Number(pricePerKg)).toLocaleString("id-ID")}
              </p>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Tanggal</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Catatan (opsional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            {error && <p className="text-danger text-sm">{error}</p>}

            <Button variant="primary" size="large" fullWidth disabled={!canSave} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan Pesanan"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
