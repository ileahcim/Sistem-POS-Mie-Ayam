"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail } from "@/lib/orders/get-order-detail";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { ReceiptData } from "@/lib/printing/types";
import { getPrinter } from "@/lib/printing/get-printer";
import { formatRupiah, groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
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
  nav,
}: {
  order: OrderDetail;
  menu: MenuCategory[];
  autoPrintReceipt: boolean;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when autoPrintReceipt is off and payment just succeeded — the
  // transaction is already fully saved at this point either way (CLAUDE.md
  // "Opsi Print"), this state purely gates whether the PRINT action itself
  // happens before leaving the screen.
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(null);
  const [printing, setPrinting] = useState(false);

  // RECEIVABLE (piutang) is still payable — settling it later is the whole
  // point. Only PAID/VOID actually block the payment UI.
  const alreadyPaid = order.status !== "OPEN" && order.status !== "RECEIVABLE";

  async function handlePay() {
    if (!method) return;
    setPaying(true);
    setError(null);
    try {
      const result = await payOrder(order.id, method, null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (autoPrintReceipt) {
        await getPrinter("mock").printReceipt(result.receipt);
        router.push("/order-aktif");
      } else {
        setPendingReceipt(result.receipt);
      }
    } finally {
      setPaying(false);
    }
  }

  async function handlePrintChoice(shouldPrint: boolean) {
    if (shouldPrint && pendingReceipt) {
      setPrinting(true);
      try {
        await getPrinter("mock").printReceipt(pendingReceipt);
      } finally {
        setPrinting(false);
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
            <div>
              <p className="text-ink text-lg font-bold">Cetak struk?</p>
              <p className="text-ink-muted mt-1 text-sm">Transaksi sudah tersimpan — ini cuma soal cetak kertasnya.</p>
            </div>
            <div className="flex w-full max-w-xs gap-2">
              <Button
                variant="secondary"
                size="large"
                fullWidth
                disabled={printing}
                onClick={() => handlePrintChoice(false)}
              >
                Tidak
              </Button>
              <Button
                variant="primary"
                size="large"
                fullWidth
                disabled={printing}
                onClick={() => handlePrintChoice(true)}
              >
                {printing ? "Mencetak..." : "Ya, Cetak"}
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
              <div className="divide-border flex flex-col divide-y">
                {order.items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1 p-4">
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
                ))}
              </div>
              <div className="border-border flex flex-col gap-1 border-t px-4 py-3">
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
              </div>
            </Card>

            {order.status === "OPEN" && (
              <div className="mt-4">
                <AddItemsPanel orderId={order.id} menu={menu} onAdded={() => router.refresh()} />
              </div>
            )}

            {order.status === "OPEN" && (
              <div className="mt-3 flex justify-center">
                <SplitAndPayButton order={order} />
              </div>
            )}

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

            {error && <p className="text-danger mt-3 text-sm">{error}</p>}
          </>
        )}
      </div>

      {!alreadyPaid && !pendingReceipt && (
        <div className="border-border bg-surface border-t p-4">
          <Button variant="primary" size="large" fullWidth disabled={!method || paying} onClick={handlePay}>
            {paying ? "Memproses..." : `Bayar - ${formatRupiah(order.total)}`}
          </Button>
        </div>
      )}
    </div>
  );
}
