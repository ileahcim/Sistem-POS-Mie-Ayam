"use client";

import { useState } from "react";
import { cancelOrderWithDeposit, type DepositDisposition } from "@/app/pesanan-terjadwal/deposit-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ReasonSheet } from "@/components/order-aktif/reason-sheet";
import { formatRupiah } from "@/lib/printing/format";
import { DEPOSIT_METHOD_LABEL, type DepositMethod } from "@/lib/deposits/settle";

const QUICK_REASONS = ["Pelanggan tidak jadi", "Salah input", "Order dobel"];

function Choice({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-card w-full border p-3 text-left",
        selected ? "border-primary bg-primary-soft" : "border-border bg-surface",
      )}
    >
      <span className="text-ink block text-base font-bold">{title}</span>
      <span className="text-ink-muted mt-0.5 block text-sm">{description}</span>
    </button>
  );
}

// "Batalkan Order" for a pre-order that already took DP. The DP is real money
// that has to go somewhere, so the owner picks its fate before anything is
// written (cancelOrderWithDeposit — OWNER only, checked on the server; the
// plain cancel refuses any order that holds DP).
export function CancelDepositOrderButton({
  orderId,
  deposits,
  onCancelled,
}: {
  orderId: string;
  deposits: { method: DepositMethod; amount: number }[];
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<DepositDisposition | null>(null);

  const total = deposits.reduce((sum, d) => sum + d.amount, 0);
  const cashPart = deposits.filter((d) => d.method === "CASH").reduce((sum, d) => sum + d.amount, 0);
  const held = deposits.map((d) => `${formatRupiah(d.amount)} (${DEPOSIT_METHOD_LABEL[d.method]})`).join(" + ");

  return (
    <>
      <Button variant="danger" size="large" fullWidth onClick={() => setOpen(true)}>
        Batalkan Order
      </Button>
      <ReasonSheet
        open={open}
        title="Batalkan pre-order ber-DP?"
        inputId={`cancel-dp-reason-${orderId}`}
        quickReasons={QUICK_REASONS}
        confirmLabel={
          choice === "REFUND" ? "Ya, Batalkan & Kembalikan DP" : choice === "FORFEIT" ? "Ya, Batalkan — DP Hangus" : "Pilih nasib DP dulu"
        }
        busyLabel="Membatalkan..."
        confirmDisabled={!choice}
        footnote="Order yang dibatalkan tetap tercatat di Riwayat Pesanan, lengkap dengan nasib DP-nya."
        notice={
          <div className="flex flex-col gap-2">
            <p className="text-ink text-sm">
              Pelanggan sudah membayar DP <span className="font-bold">{held}</span>. Mau diapakan uang mukanya?
            </p>
            <Choice
              selected={choice === "REFUND"}
              title="Kembalikan DP"
              description={
                cashPart > 0
                  ? `${formatRupiah(total)} dikembalikan ke pelanggan. Bagian tunai ${formatRupiah(cashPart)} keluar dari laci hari ini — butuh shift terbuka.`
                  : `${formatRupiah(total)} dikembalikan ke pelanggan lewat QRIS. Tidak menyentuh laci.`
              }
              onClick={() => setChoice("REFUND")}
            />
            <Choice
              selected={choice === "FORFEIT"}
              title="DP hangus"
              description={`Pelanggan batal dan ${formatRupiah(total)} tidak dikembalikan. Dicatat sebagai pendapatan hari ini dengan label "DP hangus", terpisah dari penjualan makanan. Butuh shift terbuka.`}
              onClick={() => setChoice("FORFEIT")}
            />
          </div>
        }
        onSubmit={(reason) => cancelOrderWithDeposit(orderId, choice!, reason)}
        onClose={() => {
          setOpen(false);
          setChoice(null);
        }}
        onDone={onCancelled}
      />
    </>
  );
}
