"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { changePaymentMethod } from "@/app/riwayat-pesanan/actions";
import {
  CHANGEABLE_PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  formatPaymentMethodDetail,
  type ChangeablePaymentMethod,
} from "@/lib/orders/payment-method-label";
import { validateSplitCashAmount } from "@/lib/orders/validate-split-payment";
import { formatRupiah } from "@/lib/printing/format";
import { Sheet } from "@/components/ui/sheet";
import { SheetItem } from "@/components/ui/sheet-motion";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";

const QUICK_REASONS = ["Salah pilih metode bayar", "Pelanggan minta ganti metode"];
const SPLIT_CASH_PRESETS = [10000, 20000, 50000];

// Correcting a mis-tapped payment method on an already-PAID order — CLAUDE.md
// "Ubah Metode Bayar", 24 Sep 2026. OWNER only (the caller only renders this
// for an owner; changePaymentMethod enforces it server-side regardless), and
// only while the order's shift is still open (the caller only renders this
// when shiftClosed is false — same split as VoidOrderButton).
export function ChangePaymentMethodButton({
  orderId,
  orderLabel,
  currentMethod,
  currentCashAmount,
  currentQrisAmount,
  amountCharged,
  onChanged,
}: {
  orderId: string;
  orderLabel: string;
  currentMethod: "CASH" | "QRIS" | "TRANSFER" | "SPLIT" | null;
  currentCashAmount: number | null;
  currentQrisAmount: number | null;
  // What THIS payment actually collected — the reference SPLIT amounts are
  // validated against (total minus any DP already applied, never the raw
  // order total — see changePaymentMethod's own comment on amountCharged).
  amountCharged: number;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ChangeablePaymentMethod | null>(null);
  const [splitCash, setSplitCash] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitCashError =
    method === "SPLIT" ? validateSplitCashAmount(typeof splitCash === "number" ? splitCash : NaN, amountCharged) : null;
  const splitQris = method === "SPLIT" && typeof splitCash === "number" ? Math.max(0, amountCharged - splitCash) : 0;
  const canConfirm = !!method && (method !== "SPLIT" || splitCashError === null) && reason.trim().length > 0;

  function openSheet() {
    setMethod(null);
    setSplitCash("");
    setReason("");
    setError(null);
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
  }

  async function handleConfirm() {
    if (!canConfirm || !method) return;
    setSaving(true);
    setError(null);
    try {
      const result = await changePaymentMethod(orderId, method, method === "SPLIT" ? (splitCash as number) : null, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="large" fullWidth onClick={openSheet}>
        Ubah Metode Bayar
      </Button>
      <AnimatePresence>
        {open && (
          <Sheet
            title={`Ubah metode bayar ${orderLabel}?`}
            onClose={close}
            footer={
              <Button variant="primary" size="large" fullWidth disabled={saving || !canConfirm} onClick={handleConfirm}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            }
          >
            <SheetItem index={0} className="mb-3">
              <p className="text-ink-muted text-sm">
                Sekarang: {formatPaymentMethodDetail(currentMethod, currentCashAmount, currentQrisAmount)}
              </p>
            </SheetItem>

            <SheetItem index={1}>
              <p className="text-ink mb-2 text-sm font-bold">Metode baru</p>
            </SheetItem>
            <div className="mb-3 flex gap-2">
              {CHANGEABLE_PAYMENT_METHODS.map((m, i) => (
                <SheetItem key={m} index={2 + i} interactive className="flex-1">
                  <button
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-pill h-12 w-full text-sm font-semibold",
                      method === m ? "bg-primary text-white" : "bg-muted text-ink",
                    )}
                  >
                    {PAYMENT_METHOD_LABEL[m]}
                  </button>
                </SheetItem>
              ))}
            </div>

            {method === "SPLIT" && (
              <SheetItem index={2 + CHANGEABLE_PAYMENT_METHODS.length} className="mb-3">
                <div className="flex flex-col gap-2">
                  <span className="text-ink-muted text-sm font-medium">Jumlah tunai</span>
                  <RupiahInput value={splitCash} onChange={setSplitCash} placeholder="0" className="h-12 text-base" />
                  <div className="flex flex-wrap gap-2">
                    {SPLIT_CASH_PRESETS.filter((p) => p < amountCharged).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSplitCash(preset)}
                        aria-pressed={splitCash === preset}
                        className={cn(
                          "rounded-pill h-11 px-4 text-sm font-semibold",
                          splitCash === preset ? "bg-primary text-white" : "bg-muted text-ink",
                        )}
                      >
                        {preset / 1000}rb
                      </button>
                    ))}
                  </div>
                  {splitCashError ? (
                    <p className="text-danger text-sm">{splitCashError}</p>
                  ) : (
                    typeof splitCash === "number" &&
                    splitCash > 0 && (
                      <p className="text-ink-muted text-sm">
                        Tunai {formatRupiah(splitCash)} · QRIS {formatRupiah(splitQris)}
                      </p>
                    )
                  )}
                </div>
              </SheetItem>
            )}

            <SheetItem index={3 + CHANGEABLE_PAYMENT_METHODS.length}>
              <p className="text-ink mb-2 text-sm font-bold">Alasan</p>
            </SheetItem>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_REASONS.map((r, i) => (
                <SheetItem key={r} index={4 + CHANGEABLE_PAYMENT_METHODS.length + i} interactive className="rounded-pill">
                  <button
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      "rounded-pill h-12 border px-4 text-sm font-semibold",
                      reason === r ? "border-primary bg-primary-soft text-primary" : "border-border text-ink",
                    )}
                  >
                    {r}
                  </button>
                </SheetItem>
              ))}
            </div>
            <SheetItem index={4 + CHANGEABLE_PAYMENT_METHODS.length + QUICK_REASONS.length}>
              <label htmlFor={`change-method-reason-${orderId}`} className="text-ink-muted mb-1 block text-sm">
                Atau tulis alasan lain
              </label>
              <input
                id={`change-method-reason-${orderId}`}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="mis. salah tekan tombol"
                className="rounded-input border-border h-12 w-full border px-3 text-base"
              />
            </SheetItem>

            {error && <p className="text-danger mt-2 text-sm">{error}</p>}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
