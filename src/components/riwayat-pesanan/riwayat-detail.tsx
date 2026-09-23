"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail as OrderDetailData } from "@/lib/orders/get-order-detail";
import type { PrinterDriver, ReceiptData } from "@/lib/printing/types";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { getPrinter } from "@/lib/printing/get-printer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { AppHeader } from "@/components/ui/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { groupAddonsForPrint, formatAddonWithQty, formatRupiah } from "@/lib/printing/format";
import { DEPOSIT_METHOD_LABEL } from "@/lib/deposits/settle";
import { formatPaymentMethodDetail } from "@/lib/orders/payment-method-label";
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

function formatJamOnly(iso: string): string {
  return formatId(new Date(iso), { timeStyle: "short" });
}

// Same "Dipesan" + status-appropriate second time as the list (Riwayat
// Pesanan screen) — see get-order-history.ts's settledAtOf for the reasoning.
function secondTimeLabel(order: OrderDetailData): string | null {
  if (order.paidAt) return `Dibayar ${formatJamOnly(order.paidAt)}`;
  if (order.cancelledAt) return `Dibatalkan ${formatJamOnly(order.cancelledAt)}`;
  return null;
}

// Read-only — unlike OrderDetail (order-aktif), this order has already
// concluded (see riwayat-pesanan/[orderId]/page.tsx's settled-status guard),
// so there's no Serve/Pay/Add-item action here — only the record, a
// reprint, and (OWNER, PAID only) Void. `receipt` is null for a VOID/RECEIVABLE/CANCELLED order — nothing was ever
// printed for those (CLAUDE.md "Print hanya sekali, saat pembayaran").
export function RiwayatDetail({
  order,
  receipt,
  printerDriver,
  nav,
  isOwner,
}: {
  order: OrderDetailData;
  receipt: ReceiptData | null;
  printerDriver: PrinterDriver;
  nav: HeaderNav;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  async function handleReprint() {
    if (!receipt) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const printResult = await getPrinter(printerDriver).printReceipt(receipt);
      if (!printResult.ok) setPrintError(printResult.error);
    } catch (printError) {
      setPrintError(printError instanceof Error ? printError.message : String(printError));
    } finally {
      setPrinting(false);
    }
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
        subtitle={`No. Order ${order.orderNumber} · Dipesan ${formatDateTime(order.createdAt)}${
          secondTimeLabel(order) ? ` · ${secondTimeLabel(order)}` : ""
        }`}
        actions={
          <LinkButton href="/riwayat-pesanan" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[order.status] ?? "neutral"}>
            {STATUS_LABEL[order.status] ?? order.status}
          </Badge>
          {order.paymentMethod && (
            <span className="text-ink-muted text-sm">
              via {formatPaymentMethodDetail(order.paymentMethod, order.splitCashAmount, order.splitQrisAmount)}
            </span>
          )}
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
            {/* A cancelled pre-order that took DP: what became of the money. */}
            {order.depositOutcomes.map((o, i) => (
              <p key={i} className="text-ink mt-0.5 text-sm font-semibold">
                {o.kind === "REFUNDED"
                  ? `DP dikembalikan ${formatRupiah(o.amount)} (${DEPOSIT_METHOD_LABEL[o.method]})`
                  : `DP hangus ${formatRupiah(o.amount)} (${DEPOSIT_METHOD_LABEL[o.method]}) — dicatat sebagai pendapatan`}
              </p>
            ))}
          </Card>
        )}

        <Card>
          <div className="divide-border flex flex-col divide-y">
            {order.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5 p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-base font-semibold text-ink">
                    {item.qty}x {item.productName}
                    {/* Owner-visible marker for a manually-typed price (22
                        Sep 2026) — see CLAUDE.md "+ Item Custom". */}
                    {item.isCustom && (
                      <span className="ml-2 inline-block align-middle">
                        <Badge variant="warning">Custom</Badge>
                      </span>
                    )}
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
            {order.deposits.map((d) => (
              <div key={d.id} className="flex justify-between text-sm text-ink-muted">
                <span>
                  DP {formatId(new Date(d.receivedAt), { day: "numeric", month: "short" })}, {DEPOSIT_METHOD_LABEL[d.method]}
                </span>
                <PriceText amount={d.amount} weight="secondary" />
              </div>
            ))}
            {order.deposits.length > 0 && order.status === "PAID" && (
              <div className="mt-1 flex justify-between border-t border-border pt-2">
                <span className="text-base font-bold text-ink">
                  {order.refundDue > 0 ? "Dikembalikan ke pelanggan" : "Sisa dibayar"}
                </span>
                <PriceText amount={order.refundDue > 0 ? order.refundDue : order.amountDue} weight="total" />
              </div>
            )}
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
                splitCashAmount={order.splitCashAmount}
                splitQrisAmount={order.splitQrisAmount}
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
              {printError && <p className="text-danger mt-1 text-sm">Cetak gagal: {printError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
