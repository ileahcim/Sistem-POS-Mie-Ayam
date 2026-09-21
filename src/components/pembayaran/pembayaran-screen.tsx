"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail } from "@/lib/orders/get-order-detail";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver, ReceiptData } from "@/lib/printing/types";
import { getPrinter } from "@/lib/printing/get-printer";
import { formatRupiah, groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { portionPriceOf, sortOrderLines } from "@/lib/orders/line-order";
import { OrderLineList, PortionTotalRow } from "@/components/ui/order-line-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/ui/price-text";
import { cn } from "@/components/ui/cn";
import { AppHeader } from "@/components/ui/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { AddItemsPanel } from "@/components/order-aktif/add-items-panel";
import { SplitAndPayButton } from "@/components/order-aktif/split-and-pay-sheet";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { formatId } from "@/lib/timezone";
import { DEPOSIT_METHOD_LABEL } from "@/lib/deposits/settle";
import { payOrder, type PaymentMethod } from "@/app/pembayaran/actions";

// Cash and QRIS only — no Transfer button. Payment is always "tap method,
// tap Bayar": cashReceived is always the order total, no denomination
// input, no change calculation. See CLAUDE.md "Pembayaran".
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "QRIS", label: "QRIS" },
];

export function PembayaranScreen({
  order,
  menu,
  autoPrintReceipt,
  printerDriver,
  nav,
}: {
  order: OrderDetail;
  menu: MenuCategory[];
  autoPrintReceipt: boolean;
  printerDriver: PrinterDriver;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  // Set once the payment succeeded but the paper still needs a decision:
  // autoPrintReceipt is off (ask "Cetak struk?") or the automatic print
  // failed (retry / skip, with the reason in printError). The transaction is
  // already fully saved either way (CLAUDE.md "Opsi Print") — this state only
  // gates the PRINT action, never the payment.
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(null);
  const [printing, setPrinting] = useState(false);

  // RECEIVABLE (piutang) is still payable — settling it later is the whole
  // point. Only PAID/VOID actually block the payment UI.
  const alreadyPaid = order.status !== "OPEN" && order.status !== "RECEIVABLE";

  // A pre-order that took DP: only the remainder is collected here. When the DP
  // already covers everything (or the order shrank below it) there is nothing to
  // collect, so no method has to be picked — and a leftover DP is shown as
  // "Kembalikan Rp X", never as a silent zero.
  const hasDeposit = order.deposits.length > 0;
  const nothingToCollect = hasDeposit && order.amountDue === 0;
  const canPay = nothingToCollect || !!method;
  const payLabel = !hasDeposit
    ? `Bayar - ${formatRupiah(order.total)}`
    : nothingToCollect
      ? order.refundDue > 0
        ? `Selesai - Kembalikan ${formatRupiah(order.refundDue)}`
        : "Selesai - Lunas oleh DP"
      : `Bayar Sisa - ${formatRupiah(order.amountDue)}`;

  // Outcome of a print attempt as plain text: null when the command went out,
  // otherwise the reason. Never throws — a printer problem must never turn
  // into an unhandled error on a payment that is already saved.
  async function tryPrint(receipt: ReceiptData): Promise<string | null> {
    try {
      const printResult = await getPrinter(printerDriver).printReceipt(receipt);
      if (printResult.ok) return null;
      console.error("Cetak struk gagal:", printResult.error);
      return printResult.error;
    } catch (error) {
      console.error("Cetak struk gagal:", error);
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function handlePay() {
    if (!canPay) return;
    setPaying(true);
    setError(null);
    try {
      // With nothing to collect the server labels the order after the DP that
      // covered it; the value sent here is then ignored.
      const result = await payOrder(order.id, method ?? "CASH", null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (autoPrintReceipt) {
        const failure = await tryPrint(result.receipt);
        if (failure === null) {
          router.push("/order-aktif");
          return;
        }
        // The payment is saved; only the paper failed. Stay here with the
        // reason on screen (instead of leaving silently, as before) so the
        // cashier can retry or skip, and the real cause becomes visible.
        setPrintError(failure);
      }
      setPendingReceipt(result.receipt);
    } finally {
      setPaying(false);
    }
  }

  async function handlePrintChoice(shouldPrint: boolean) {
    if (shouldPrint && pendingReceipt) {
      setPrinting(true);
      setPrintError(null);
      const failure = await tryPrint(pendingReceipt);
      setPrinting(false);
      if (failure !== null) {
        setPrintError(failure);
        return; // stay: show why, let the cashier retry or skip
      }
    }
    router.push("/order-aktif");
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title={`Pembayaran ${order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : "(Pre-order)"}`}
        subtitle={`No. Order ${order.orderNumber}`}
        actions={
          <LinkButton href={`/order-aktif/${order.id}`} variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {pendingReceipt ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Badge variant="success">Pembayaran berhasil</Badge>
            {printError ? (
              <div className="flex flex-col gap-1">
                <p className="text-danger text-lg font-bold">Struk belum tercetak</p>
                <p className="text-ink-muted text-sm">
                  Transaksi sudah tersimpan. Pastikan printer menyala dan Bluetooth tablet aktif, lalu coba lagi.
                </p>
                <p className="text-ink-faint text-xs">Penyebab: {printError}</p>
              </div>
            ) : (
              <div>
                <p className="text-ink text-lg font-bold">Cetak struk?</p>
                <p className="text-ink-muted mt-1 text-sm">Transaksi sudah tersimpan — ini cuma soal cetak kertasnya.</p>
              </div>
            )}
            <div className="flex w-full max-w-xs gap-2">
              <Button
                variant="secondary"
                size="large"
                fullWidth
                disabled={printing}
                onClick={() => handlePrintChoice(false)}
              >
                {printError ? "Lewati" : "Tidak"}
              </Button>
              <Button
                variant="primary"
                size="large"
                fullWidth
                disabled={printing}
                onClick={() => handlePrintChoice(true)}
              >
                {printing ? "Mencetak..." : printError ? "Coba Lagi" : "Ya, Cetak"}
              </Button>
            </div>
          </div>
        ) : alreadyPaid ? (
          <div className="flex justify-center py-8">
            <Badge variant="success">Sudah dibayar ({order.paymentMethod})</Badge>
          </div>
        ) : (
          <>
            <Card>
              <div className="flex flex-col">
                {/* Same reading order and grouping as the cart and the order detail. */}
                <OrderLineList
                  lines={sortOrderLines(order.items, portionPriceOf)}
                  keyOf={(item) => item.id}
                  divided
                  inset="px-4"
                  renderLine={(item) => (
                  <div className="flex flex-col gap-1 p-4">
                    <div className="flex justify-between gap-3">
                      <span className="text-base font-semibold text-ink">
                        {item.qty}x {item.productName}
                      </span>
                      <PriceText amount={item.lineTotal} weight="secondary" />
                    </div>
                    {(item.addons.length > 0 || item.notes) && (
                      <span className="text-ink-muted text-sm">
                        {[groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", "), item.notes]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                  )}
                />
              </div>
              <div className="border-border flex flex-col gap-1 border-t px-4 py-3">
                <PortionTotalRow lines={order.items} />
                <div className="flex justify-between text-sm text-ink-muted">
                  <span>Subtotal</span>
                  <PriceText amount={order.subtotal} weight="secondary" />
                </div>
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm text-ink-muted">
                    <span>Ongkir</span>
                    <PriceText amount={order.deliveryFee} weight="secondary" />
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-border pt-2">
                  <span className="text-base font-bold text-ink">Total</span>
                  <PriceText amount={order.total} weight="total" />
                </div>
                {hasDeposit && (
                  <>
                    {order.deposits.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm text-ink-muted">
                        <span>
                          DP {formatId(new Date(d.receivedAt), { day: "numeric", month: "short" })},{" "}
                          {DEPOSIT_METHOD_LABEL[d.method]}
                        </span>
                        <PriceText amount={d.amount} weight="secondary" />
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between border-t border-border pt-2">
                      {order.refundDue > 0 ? (
                        <>
                          <span className="text-base font-bold text-danger">Kembalikan ke pelanggan</span>
                          <PriceText amount={order.refundDue} weight="total" />
                        </>
                      ) : (
                        <>
                          <span className="text-base font-bold text-ink">Sisa dibayar</span>
                          <PriceText amount={order.amountDue} weight="total" />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>

            {order.status === "OPEN" && (
              <div className="mt-4">
                <AddItemsPanel orderId={order.id} menu={menu} onAdded={() => router.refresh()} />
              </div>
            )}

            {order.status === "OPEN" && !hasDeposit && (
              <div className="mt-3 flex justify-center">
                <SplitAndPayButton order={order} />
              </div>
            )}

            {nothingToCollect ? (
              <p className="text-ink-muted mt-4 text-center text-sm">
                {order.refundDue > 0
                  ? `DP lebih besar dari total pesanan — kembalikan ${formatRupiah(order.refundDue)} ke pelanggan, lalu tekan Selesai.`
                  : "DP sudah menutup seluruh pesanan — tidak ada yang perlu dibayar lagi."}
              </p>
            ) : (
            <div className="mt-4 flex gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "rounded-pill h-12 flex-1 text-base font-semibold",
                    method === m.value ? "bg-primary text-white" : "bg-muted text-ink",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            )}

            {error && <p className="text-danger mt-3 text-sm">{error}</p>}
          </>
        )}
      </div>

      {!alreadyPaid && !pendingReceipt && (
        <div className="border-border bg-surface border-t p-4">
          <Button variant="primary" size="large" fullWidth disabled={!canPay || paying} onClick={handlePay}>
            {paying ? "Memproses..." : payLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
