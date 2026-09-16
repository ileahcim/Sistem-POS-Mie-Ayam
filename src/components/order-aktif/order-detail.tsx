"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderDetail as OrderDetailData } from "@/lib/orders/get-order-detail";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { PackingListData } from "@/lib/printing/types";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { getPrinter } from "@/lib/printing/get-printer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { AddItemsPanel } from "./add-items-panel";
import { SplitAndPayButton } from "./split-and-pay-sheet";
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
  orderAktifIndicator,
}: {
  order: OrderDetailData;
  menu: MenuCategory[];
  packingList: PackingListData | null;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();
  const [markingServed, setMarkingServed] = useState(false);

  const canAddItems = order.status === "OPEN";
  const canPay = order.status === "OPEN";
  const needsServing = !order.servedAt;
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
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-3 py-2">
        <div>
          <h1 className="text-lg font-bold text-ink">
            {order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : "Pre-order"} ·{" "}
            {CHANNEL_LABEL[order.channel]}
            {order.tableLabel ? ` · ${order.tableLabel}` : ""}
          </h1>
          {order.scheduledFor && (
            <p className="text-primary-strong text-sm font-medium">
              Kirim {formatScheduledFor(order.scheduledFor)}
            </p>
          )}
          <p className="text-ink-muted text-sm">
            No. Order {order.orderNumber}
            {order.customerName ? ` · ${order.customerName}` : ""}
          </p>
        </div>
        <Link href="/order-aktif" className="rounded-pill bg-muted h-10 px-4 text-sm font-medium leading-10 text-ink">
          Kembali
        </Link>
      </div>

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
