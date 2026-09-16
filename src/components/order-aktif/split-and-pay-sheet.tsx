"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { OrderDetail } from "@/lib/orders/get-order-detail";
import { splitAndPay } from "@/app/order-aktif/actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";

// "Pisahkan & Bayar" — CLAUDE.md "Split payment": deliberately a secondary,
// two-step affordance (a plain ghost button that opens a sheet, never in
// the primary payment button row) so it never adds friction to the normal
// single-order "tap Bayar" path — this is the rare-group-splits-the-bill
// case, not the everyday one. Renders nothing when there's nothing to
// split (not OPEN, or only 1 unit total on the order).
export function SplitAndPayButton({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);
  if (order.status !== "OPEN" || totalQty <= 1) return null;

  const selectedQtyTotal = Object.values(selected).reduce((a, b) => a + b, 0);
  const canConfirm = selectedQtyTotal > 0 && selectedQtyTotal < totalQty;

  function setQty(itemId: string, qty: number) {
    setSelected((prev) => ({ ...prev, [itemId]: qty }));
    setError(null);
  }

  function closeAndReset() {
    setOpen(false);
    setSelected({});
    setError(null);
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const selections = Object.entries(selected)
        .filter(([, qty]) => qty > 0)
        .map(([orderItemId, qty]) => ({ orderItemId, qty }));
      const result = await splitAndPay(order.id, selections);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/pembayaran/${result.newOrderId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Pisahkan & Bayar
      </Button>
      <AnimatePresence>
        {open && (
          <Sheet
            title="Pisahkan & Bayar"
            onClose={closeAndReset}
            footer={
              <Button
                variant="primary"
                size="large"
                fullWidth
                disabled={!canConfirm || saving}
                onClick={handleConfirm}
              >
                {saving ? "Memproses..." : "Pisahkan & Lanjut Bayar"}
              </Button>
            }
          >
            <p className="text-ink-muted mb-3 text-sm">
              Pilih item (dan jumlahnya) yang mau dipisah ke pembayaran sendiri. Sisanya tetap di order ini.
            </p>
            <div className="divide-border flex flex-col divide-y">
              {order.items.map((item) => {
                const qty = selected[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-ink text-sm font-semibold">{item.productName}</p>
                      {(item.addons.length > 0 || item.notes) && (
                        <p className="text-ink-muted truncate text-xs">
                          {[groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", "), item.notes]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      <p className="text-ink-faint text-xs">Total {item.qty}x</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQty(item.id, Math.max(0, qty - 1))}
                        disabled={qty === 0}
                        className="border-border text-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl disabled:opacity-30"
                        aria-label={`Kurangi ${item.productName}`}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-base font-semibold text-ink">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(item.id, Math.min(item.qty, qty + 1))}
                        disabled={qty >= item.qty}
                        className="border-border text-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl disabled:opacity-30"
                        aria-label={`Tambah ${item.productName}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-danger mt-3 text-sm">{error}</p>}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
