"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { OrderDetail } from "@/lib/orders/get-order-detail";
import type { PrinterDriver } from "@/lib/printing/types";
import { recordDeposit, getDepositReceipt } from "@/app/pesanan-terjadwal/deposit-actions";
import { printDepositReceiptSafely } from "@/lib/printing/print-deposit";
import { DEPOSIT_METHOD_LABEL } from "@/lib/deposits/settle";
import { formatRupiah } from "@/lib/printing/format";
import { formatId } from "@/lib/timezone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { Sheet } from "@/components/ui/sheet";
import { DepositPicker, initialDepositDraft, type DepositDraft } from "./deposit-picker";
import { useDepositReceiptPrompt } from "./use-deposit-receipt-prompt";
import { formatTenderedNote, validateCashTendered } from "@/lib/orders/cash-change";
import { CashTenderedField } from "@/components/pembayaran/cash-tendered-field";

// The DP of one pre-order on its detail screen: each DP taken (with a reprint of
// its "BUKTI UANG MUKA"), what is still owed — or, when the order shrank below
// the DP, what has to go back — and "+ Catat DP" while the order is still open.
export function DepositCard({
  order,
  cashAvailable,
  autoPrint,
  printerDriver,
  cashChangeEnabled,
}: {
  order: OrderDetail;
  cashAvailable: boolean;
  autoPrint: boolean;
  printerDriver: PrinterDriver;
  cashChangeEnabled: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<DepositDraft>(() => initialDepositDraft(cashAvailable));
  // "Uang diterima" for a cash DP (see CashTenderedField) — measured against the DP amount.
  const [tendered, setTendered] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [reprintError, setReprintError] = useState<string | null>(null);

  const { handleRecorded, prompt } = useDepositReceiptPrompt({
    autoPrint,
    printerDriver,
    onFinished: () => router.refresh(),
  });

  const room = Math.max(0, order.total - order.depositTotal);
  const canAdd = order.status === "OPEN" && !!order.scheduledFor && room > 0;

  function closeSheet() {
    setSheetOpen(false);
    setError(null);
    setDraft(initialDepositDraft(cashAvailable));
    setTendered("");
  }

  const asksTendered = cashChangeEnabled && draft.method === "CASH" && draft.amount > 0;
  const tenderedOk = typeof tendered === "number" && validateCashTendered(tendered, draft.amount) === null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await recordDeposit(order.id, draft.amount, draft.method, asksTendered ? (tendered as number) : null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeSheet();
      await handleRecorded(result.receipt);
    } finally {
      setSaving(false);
    }
  }

  async function handleReprint(depositId: string) {
    setReprintingId(depositId);
    setReprintError(null);
    try {
      const result = await getDepositReceipt(order.id, depositId);
      if (!result.ok) {
        setReprintError(result.error);
        return;
      }
      const failure = await printDepositReceiptSafely(printerDriver, result.receipt);
      if (failure !== null) setReprintError(failure);
    } finally {
      setReprintingId(null);
    }
  }

  return (
    <Card padded className="mt-3 flex flex-col gap-2">
      {prompt}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-ink text-base font-bold">Uang Muka (DP)</h3>
        {canAdd && (
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            + Catat DP
          </Button>
        )}
      </div>

      {order.deposits.length === 0 ? (
        <p className="text-ink-faint text-sm">Belum ada DP untuk pesanan ini.</p>
      ) : (
        <div className="divide-border flex flex-col divide-y">
          {order.deposits.map((d) => {
            const when = new Date(d.receivedAt);
            return (
              <div key={d.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-ink text-sm font-semibold">
                    DP {formatId(when, { day: "numeric", month: "short" })}, {DEPOSIT_METHOD_LABEL[d.method]}
                  </div>
                  <div className="text-ink-faint text-xs">
                    {formatId(when, { hour: "2-digit", minute: "2-digit", hour12: false })} · {d.receivedByName}
                  </div>
                  {d.cashTendered != null && (
                    <div className="text-ink-faint text-xs">{formatTenderedNote(d.cashTendered, d.changeGiven)}</div>
                  )}
                </div>
                <PriceText amount={d.amount} weight="secondary" />
                {order.status === "OPEN" && (
                  <Button variant="secondary" disabled={reprintingId === d.id} onClick={() => handleReprint(d.id)}>
                    {reprintingId === d.id ? "..." : "Cetak"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {reprintError && <p className="text-danger text-sm">Cetak bukti gagal: {reprintError}</p>}

      {order.deposits.length > 0 && (
        <div className="border-border flex items-center justify-between border-t pt-2">
          {order.refundDue > 0 ? (
            <>
              <span className="text-danger text-base font-bold">Kembalikan ke pelanggan</span>
              <PriceText amount={order.refundDue} weight="total" />
            </>
          ) : (
            <>
              <span className="text-ink text-base font-bold">Sisa yang harus dibayar</span>
              <PriceText amount={order.amountDue} weight="total" />
            </>
          )}
        </div>
      )}
      {order.refundDue > 0 && (
        <p className="text-ink-muted text-sm">
          Pesanan sekarang {formatRupiah(order.total)}, lebih kecil dari DP {formatRupiah(order.depositTotal)}. Selisihnya
          dikembalikan saat pembayaran.
        </p>
      )}

      <AnimatePresence>
        {sheetOpen && (
          <Sheet
            title="Catat DP"
            onClose={closeSheet}
            footer={
              <Button
                variant="primary"
                size="large"
                fullWidth
                disabled={saving || draft.amount <= 0 || draft.amount > room || (asksTendered && !tenderedOk)}
                onClick={handleSave}
              >
                {saving
                  ? "Menyimpan..."
                  : draft.amount > 0
                    ? `Catat DP ${formatRupiah(draft.amount)} (${DEPOSIT_METHOD_LABEL[draft.method]})`
                    : "Pilih nominal DP"}
              </Button>
            }
          >
            <p className="text-ink-muted mb-3 text-sm">
              Total pesanan {formatRupiah(order.total)}
              {order.depositTotal > 0 ? ` · sudah DP ${formatRupiah(order.depositTotal)}` : ""}
            </p>
            <DepositPicker
              total={order.total}
              alreadyHeld={order.depositTotal}
              value={draft}
              onChange={setDraft}
              cashAvailable={cashAvailable}
              allowNone={false}
            />
            {asksTendered && (
              <div className="mt-3">
                <CashTenderedField id="dp-cash-tendered" due={draft.amount} value={tendered} onChange={setTendered} />
              </div>
            )}
            {error && <p className="text-danger mt-3 text-sm">{error}</p>}
          </Sheet>
        )}
      </AnimatePresence>
    </Card>
  );
}
