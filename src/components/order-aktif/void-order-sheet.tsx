"use client";

import { useState } from "react";
import { voidPaidOrder } from "@/app/riwayat-pesanan/actions";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/printing/format";
import { ReasonSheet } from "./reason-sheet";

const QUICK_REASONS = ["Salah input pembayaran", "Uang dikembalikan ke pelanggan", "Order dobel"];

// Void for an already-PAID order — OWNER only (the caller only renders this
// for an owner; voidPaidOrder enforces it server-side regardless).
export function VoidOrderButton({
  orderId,
  orderLabel,
  total,
  paymentMethod,
  shiftClosed,
  onVoided,
}: {
  orderId: string;
  orderLabel: string;
  total: number;
  paymentMethod: string | null;
  shiftClosed: boolean;
  onVoided: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" size="large" fullWidth onClick={() => setOpen(true)}>
        Void Order
      </Button>
      <ReasonSheet
        open={open}
        title={`Void order ${orderLabel}?`}
        inputId={`void-reason-${orderId}`}
        quickReasons={QUICK_REASONS}
        confirmLabel="Ya, Void Order"
        busyLabel="Memproses..."
        notice={
          <div className="bg-danger-soft rounded-card flex flex-col gap-1 p-3 text-sm">
            <p className="text-danger font-semibold">
              Order ini sudah dibayar {formatRupiah(total)}
              {paymentMethod ? ` (${paymentMethod})` : ""}.
            </p>
            <p className="text-ink">
              {shiftClosed
                ? "Shift order ini sudah ditutup — laporan shift itu tidak berubah. Uangnya perlu dikembalikan/dicatat manual."
                : paymentMethod === "CASH"
                  ? "Setelah di-void, order ini tidak dihitung sebagai penjualan cash shift ini — kembalikan uangnya dari laci."
                  : "Setelah di-void, order ini tidak dihitung sebagai penjualan shift ini."}
            </p>
          </div>
        }
        footnote="Order yang di-void tetap tercatat di Riwayat Pesanan."
        onSubmit={(reason) => voidPaidOrder(orderId, reason)}
        onClose={() => setOpen(false)}
        onDone={onVoided}
      />
    </>
  );
}
