"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderDetail } from "@/lib/orders/get-order-detail";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { getPrinter } from "@/lib/printing/get-printer";
import { formatRupiah, groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/ui/price-text";
import { cn } from "@/components/ui/cn";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { AddItemsPanel } from "@/components/order-aktif/add-items-panel";
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
  orderAktifIndicator,
}: {
  order: OrderDetail;
  menu: MenuCategory[];
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await getPrinter("mock").printReceipt(result.receipt);
      router.push("/order-aktif");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink">
            Pembayaran {order.queueNumber != null ? `#${order.queueNumber}` : "(Pre-order)"}
          </h1>
          <p className="text-ink-muted text-sm">No. Order {order.orderNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <Link
            href={`/order-aktif/${order.id}`}
            className="rounded-pill bg-muted h-10 px-4 text-sm font-medium leading-10 text-ink"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {alreadyPaid ? (
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

      {!alreadyPaid && (
        <div className="border-border bg-surface border-t p-4">
          <Button variant="primary" size="large" fullWidth disabled={!method || paying} onClick={handlePay}>
            {paying ? "Memproses..." : `Bayar - ${formatRupiah(order.total)}`}
          </Button>
        </div>
      )}
    </div>
  );
}
