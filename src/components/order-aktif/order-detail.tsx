"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderDetail as OrderDetailData } from "@/lib/orders/get-order-detail";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { PackingListData } from "@/lib/printing/types";
import { getPrinter } from "@/lib/printing/get-printer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { AddItemsPanel } from "./add-items-panel";
import { markServed } from "@/app/order-aktif/actions";

const CHANNEL_LABEL: Record<OrderDetailData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function formatScheduledFor(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function OrderDetail({
  order,
  menu,
  packingList,
}: {
  order: OrderDetailData;
  menu: MenuCategory[];
  packingList: PackingListData | null;
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
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink">
            {order.queueNumber != null ? `#${order.queueNumber}` : "Pre-order"} · {CHANNEL_LABEL[order.channel]}
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

      <div className="flex-1 overflow-y-auto p-4">
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
                    {[item.addons.map((a) => a.name).join(", "), item.notes].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="border-border bg-canvas flex items-center justify-between rounded-b-card border-t px-4 py-3">
            <span className="text-base font-bold text-ink">Subtotal</span>
            <PriceText amount={order.subtotal} weight="total" />
          </div>
        </Card>

        {canPrintPackingList && (
          <div className="mt-4">
            <Button variant="secondary" size="large" fullWidth onClick={handlePrintDaftar}>
              Print Daftar
            </Button>
          </div>
        )}

        {canAddItems && (
          <div className="mt-4">
            <AddItemsPanel orderId={order.id} menu={menu} onAdded={() => router.refresh()} />
          </div>
        )}

        {order.status === "PAID" && (
          <div className="mt-4 flex justify-center">
            <Badge variant="success">Sudah dibayar ({order.paymentMethod})</Badge>
          </div>
        )}
      </div>

      <div className="border-border bg-surface flex gap-2 border-t p-4">
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
