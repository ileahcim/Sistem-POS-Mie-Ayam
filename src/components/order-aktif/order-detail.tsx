"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail as OrderDetailData } from "@/lib/orders/get-order-detail";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { PackingListData } from "@/lib/printing/types";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { getPrinter } from "@/lib/printing/get-printer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/ui/app-header";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { AddItemsPanel } from "./add-items-panel";
import { SplitAndPayButton } from "./split-and-pay-sheet";
import { CancelOrderButton } from "./cancel-order-sheet";
import { VoidOrderButton } from "./void-order-sheet";
import { markServed } from "@/app/order-aktif/actions";

const CHANNEL_LABEL: Record<OrderDetailData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function formatScheduledFor(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

export function OrderDetail({
  order,
  menu,
  packingList,
  nav,
  isOwner,
}: {
  order: OrderDetailData;
  menu: MenuCategory[];
  packingList: PackingListData | null;
  nav: HeaderNav;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [markingServed, setMarkingServed] = useState(false);

  const canAddItems = order.status === "OPEN";
  const canPay = order.status === "OPEN";
  // Bungkus/Antar are marked served automatically at payment (payOrder), so
  // an unpaid one never needs the manual step — only Dine In does. A PAID
  // order still unserved (older data) keeps the button as a way out.
  const needsServing =
    !order.servedAt && (order.status === "OPEN" ? order.channel === "DINE_IN" : order.status === "PAID");
  const canPrintPackingList = order.status === "OPEN" && !!packingList;

  async function handleMarkServed() {
    setMarkingServed(true);
    try {
      await markServed(order.id);
      router.push("/order-aktif");
    } finally {
      setMarkingServed(false);
    }
  }

  async function handlePrintDaftar() {
    if (!packingList) return;
    await getPrinter("mock").printPackingList(packingList);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title={
          <>
            {order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : "Pre-order"} ·{" "}
            {CHANNEL_LABEL[order.channel]}
            {order.tableLabel ? ` · ${order.tableLabel}` : ""}
          </>
        }
        subtitle={
          <>
            {order.scheduledFor && (
              <span className="text-primary-strong font-medium">Kirim {formatScheduledFor(order.scheduledFor)} · </span>
            )}
            No. Order {order.orderNumber}
            {order.customerName ? ` · ${order.customerName}` : ""}
          </>
        }
        actions={
          <LinkButton href="/order-aktif" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-3">
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
          <div className="border-border bg-canvas flex items-center justify-between rounded-b-card border-t px-3 py-2">
            <span className="text-base font-bold text-ink">Subtotal</span>
            <PriceText amount={order.subtotal} weight="total" />
          </div>
        </Card>

        {canPrintPackingList && (
          <div className="mt-3">
            <Button variant="secondary" size="large" fullWidth onClick={handlePrintDaftar}>
              Print Daftar
            </Button>
          </div>
        )}

        {order.status === "OPEN" && (
          <div className="mt-3 flex justify-center">
            <SplitAndPayButton order={order} />
          </div>
        )}

        {canAddItems && (
          <div className="mt-3">
            <AddItemsPanel orderId={order.id} menu={menu} onAdded={() => router.refresh()} />
          </div>
        )}

        {order.status === "PAID" && isOwner && (
          <div className="mt-6">
            <VoidOrderButton
              orderId={order.id}
              orderLabel={order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : `No. ${order.orderNumber}`}
              total={order.total}
              paymentMethod={order.paymentMethod}
              shiftClosed={order.shiftStatus === "CLOSED"}
              onVoided={() => router.push(`/riwayat-pesanan/${order.id}`)}
            />
          </div>
        )}

        {order.status === "OPEN" && (
          <div className="mt-6">
            <CancelOrderButton
              orderId={order.id}
              orderLabel={order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : null}
              onCancelled={() => router.push("/order-aktif")}
            />
          </div>
        )}

        {order.status === "PAID" && (
          <div className="mt-3 flex justify-center">
            <Badge variant="success">Sudah dibayar ({order.paymentMethod})</Badge>
          </div>
        )}
      </div>

      <div className="border-border bg-surface flex gap-2 border-t p-3">
        {needsServing && (
          <Button
            variant={canPay ? "secondary" : "primary"}
            size="large"
            fullWidth
            disabled={markingServed}
            onClick={handleMarkServed}
          >
            Tandai Sudah Disajikan
          </Button>
        )}
        {canPay && (
          <LinkButton href={`/pembayaran/${order.id}`} variant="primary" size="large" fullWidth>
            Lanjut ke Pembayaran
          </LinkButton>
        )}
      </div>
    </div>
  );
}
