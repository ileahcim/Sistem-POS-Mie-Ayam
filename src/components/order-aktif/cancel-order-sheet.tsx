"use client";

import { useState } from "react";
import { cancelOrder } from "@/app/order-aktif/actions";
import { Button } from "@/components/ui/button";
import { ReasonSheet } from "./reason-sheet";

const QUICK_REASONS = ["Salah input", "Pelanggan tidak jadi", "Order dobel"];

// "Batalkan Order" — cancels an unpaid (OPEN) order. Not a void: any
// cashier may do this (see cancelOrder in order-aktif/actions.ts). This is
// the ONE cancel path for unpaid orders — Order Aktif rows, the order
// detail screen, and the Tutup Shift flow all render this same component.
// Trigger sizes: `compact` for an Order Aktif row, `inline` for a
// default-height button sitting next to another one, full-width large
// otherwise.
export function CancelOrderButton({
  orderId,
  orderLabel,
  size = "full",
  onCancelled,
}: {
  orderId: string;
  orderLabel: string | null; // null for a pre-order that has no queue number yet
  size?: "compact" | "inline" | "full";
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {size === "compact" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-danger-soft text-danger rounded-pill mr-3 h-12 w-16 shrink-0 text-sm font-semibold"
          aria-label={orderLabel ? `Batalkan order ${orderLabel}` : "Batalkan pre-order"}
        >
          Batal
        </button>
      ) : (
        <Button
          variant="danger"
          size={size === "full" ? "large" : "default"}
          fullWidth
          onClick={() => setOpen(true)}
        >
          {size === "full" ? "Batalkan Order" : "Batalkan"}
        </Button>
      )}
      <ReasonSheet
        open={open}
        title={orderLabel ? `Batalkan order ${orderLabel}?` : "Batalkan pre-order ini?"}
        inputId={`cancel-reason-${orderId}`}
        quickReasons={QUICK_REASONS}
        confirmLabel="Ya, Batalkan Order"
        busyLabel="Membatalkan..."
        footnote="Order yang dibatalkan tetap tercatat di Riwayat Pesanan."
        onSubmit={(reason) => cancelOrder(orderId, reason)}
        onClose={() => setOpen(false)}
        onDone={onCancelled}
      />
    </>
  );
}
