"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderDetail as OrderDetailData } from "@/lib/orders/get-order-detail";
import type { ReceiptData } from "@/lib/printing/types";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { getPrinter } from "@/lib/printing/get-printer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { VoidOrderButton } from "@/components/order-aktif/void-order-sheet";

const CHANNEL_LABEL: Record<OrderDetailData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

const STATUS_LABEL: Record<string, string> = { PAID: "Lunas", VOID: "Void", RECEIVABLE: "Piutang", CANCELLED: "Batal" };
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PAID: "success",
  VOID: "danger",
  RECEIVABLE: "warning",
  CANCELLED: "neutral",
};

function formatDateTime(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

// Read-only — unlike OrderDetail (order-aktif), this order has already
// concluded (see riwayat-pesanan/[orderId]/page.tsx's settled-status guard),
// so there's no Serve/Pay/Add-item action here — only the record, a
// reprint, and (OWNER, PAID only) Void. `receipt` is null for a VOID/RECEIVABLE/CANCELLED order — nothing was ever
// printed for those (CLAUDE.md "Print hanya sekali, saat pembayaran").
export function RiwayatDetail({
  order,
  receipt,
  orderAktifIndicator,
  isOwner,
}: {
  order: OrderDetailData;
  receipt: ReceiptData | null;
  orderAktifIndicator: OrderAktifIndicator;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);

  async function handleReprint() {
    if (!receipt) return;
    setPrinting(true);
    try {
      await getPrinter("mock").printReceipt(receipt);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink">
            {order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : "Pre-order"} ·{" "}
            {CHANNEL_LABEL[order.channel]}
            {order.tableLabel ? ` · ${order.tableLabel}` : ""}
          </h1>
          <p className="text-ink-muted text-sm">
            No. Order {order.orderNumber} · {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <Link
            href="/riwayat-pesanan"
            className="rounded-pill bg-muted h-10 px-4 text-sm font-medium leading-10 text-ink"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[order.status] ?? "neutral"}>
            {STATUS_LABEL[order.status] ?? order.status}
          </Badge>
          {order.paymentMethod && <span className="text-ink-muted text-sm">via {order.paymentMethod}</span>}
          {order.customerName && <span className="text-ink-muted text-sm">· {order.customerName}</span>}
        </div>

        {order.status === "VOID" && order.voidReason && (
          <Card padded className="bg-danger-soft mb-3">
            <p className="text-danger text-sm font-semibold">
              Di-void{order.voidedByName ? ` oleh ${order.voidedByName}` : ""}
              {order.voidedAt ? ` · ${formatDateTime(order.voidedAt)}` : ""}
            </p>
            <p className="text-ink mt-0.5 text-sm">Alasan: {order.voidReason}</p>
          </Card>
        )}

        {order.status === "CANCELLED" && (
          <Card padded className="bg-muted mb-3">
            <p className="text-ink text-sm font-semibold">
              Dibatalkan{order.cancelledByName ? ` oleh ${order.cancelledByName}` : ""}
              {order.cancelledAt ? ` · ${formatDateTime(order.cancelledAt)}` : ""}
            </p>
            {order.cancelReason && <p className="text-ink-muted mt-0.5 text-sm">Alasan: {order.cancelReason}</p>}
          </Card>
        )}

        <Card>
          <div className="divide-border flex flex-col divide-y">
            {order.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5 p-3">
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
          <div className="border-border flex flex-col gap-1 border-t px-3 py-3">
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
      </div>

      {(receipt || (isOwner && order.status === "PAID")) && (
        <div className="border-border bg-surface flex gap-2 border-t p-4">
          {isOwner && order.status === "PAID" && (
            <div className="flex-1">
              <VoidOrderButton
                orderId={order.id}
                orderLabel={
                  order.queueNumber != null
                    ? formatQueueLabel(order.queueNumber, order.queueSuffix)
                    : `No. ${order.orderNumber}`
                }
                total={order.total}
                paymentMethod={order.paymentMethod}
                shiftClosed={order.shiftStatus === "CLOSED"}
                onVoided={() => router.refresh()}
              />
            </div>
          )}
          {receipt && (
            <div className="flex-1">
              <Button variant="primary" size="large" fullWidth disabled={printing} onClick={handleReprint}>
                {printing ? "Mencetak..." : "Cetak Ulang Struk"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
