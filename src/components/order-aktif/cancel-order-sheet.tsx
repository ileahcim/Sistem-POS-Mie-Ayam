"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { cancelOrder } from "@/app/order-aktif/actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

// One-tap reasons for the everyday cases, so the cashier rarely needs the
// keyboard (CLAUDE.md "Konteks pengguna") — free text stays available for
// anything else. The reason is still mandatory either way.
const QUICK_REASONS = ["Salah input", "Pelanggan tidak jadi", "Order dobel"];

// "Batalkan Order" — cancels an unpaid (OPEN) order. Not a void: any
// cashier may do this (see cancelOrder in order-aktif/actions.ts). The
// trigger comes in two sizes: `compact` for an Order Aktif row, full-width
// for the order detail screen.
export function CancelOrderButton({
  orderId,
  orderLabel,
  compact = false,
  onCancelled,
}: {
  orderId: string;
  orderLabel: string | null; // null for a pre-order that has no queue number yet
  compact?: boolean;
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setReason("");
    setError(null);
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const result = await cancelOrder(orderId, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      onCancelled();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-danger-soft text-danger rounded-pill mr-3 h-12 w-16 shrink-0 text-sm font-semibold"
          aria-label={orderLabel ? `Batalkan order ${orderLabel}` : "Batalkan pre-order"}
        >
          Batal
        </button>
      ) : (
        <Button variant="danger" size="large" fullWidth onClick={() => setOpen(true)}>
          Batalkan Order
        </Button>
      )}
      <AnimatePresence>
        {open && (
          <Sheet
            title={orderLabel ? `Batalkan order ${orderLabel}?` : "Batalkan pre-order ini?"}
            onClose={close}
            footer={
              <Button
                variant="danger"
                size="large"
                fullWidth
                disabled={saving || !reason.trim()}
                onClick={handleConfirm}
              >
                {saving ? "Membatalkan..." : "Ya, Batalkan Order"}
              </Button>
            }
          >
            <p className="text-ink mb-2 text-sm font-bold">Alasan</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-pill h-12 border px-4 text-sm font-semibold",
                    reason === r ? "border-danger bg-danger-soft text-danger" : "border-border text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <label htmlFor={`cancel-reason-${orderId}`} className="text-ink-muted mb-1 block text-sm">
              Atau tulis alasan lain
            </label>
            <input
              id={`cancel-reason-${orderId}`}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. salah pilih menu"
              className="rounded-input border-border h-12 w-full border px-3 text-base"
            />
            <p className="text-ink-faint mt-3 text-xs">Order yang dibatalkan tetap tercatat di Riwayat Pesanan.</p>
            {error && <p className="text-danger mt-2 text-sm">{error}</p>}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
