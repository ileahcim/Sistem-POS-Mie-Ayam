"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import type { OrderDetail as OrderDetailData } from "@/lib/orders/get-order-detail";
import type { MenuCategory, MenuProduct } from "@/lib/menu/get-active-menu";
import type { PackingListData, PrinterDriver } from "@/lib/printing/types";
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
import { formatPaymentMethodDetail } from "@/lib/orders/payment-method-label";
import { portionPriceOf, sortOrderLines } from "@/lib/orders/line-order";
import { expandAddonOptionIds, groupOrderItemAddons } from "@/lib/cart/types";
import { OrderLineList, PortionTotalRow } from "@/components/ui/order-line-list";
import { AddItemsPanel } from "./add-items-panel";
import { AddonSheet, type AddonSheetResult } from "@/components/kasir/addon-sheet";
import { SplitAndPayButton } from "./split-and-pay-sheet";
import { CancelOrderButton } from "./cancel-order-sheet";
import { VoidOrderButton } from "./void-order-sheet";
import { DepositCard } from "@/components/pesanan-terjadwal/deposit-card";
import { CancelDepositOrderButton } from "@/components/pesanan-terjadwal/cancel-deposit-order-sheet";
import { markServed, removeOrderItem, editOrderItem } from "@/app/order-aktif/actions";
import { buildKitchenTicketData } from "@/lib/orders/build-kitchen-ticket-data";
import { printKitchenTicketSafely } from "@/lib/printing/print-kitchen-ticket";
import { useKitchenTicketPrompt } from "@/components/printing/use-kitchen-ticket-prompt";

const CHANNEL_LABEL: Record<OrderDetailData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function formatScheduledFor(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

// One line of a saved order. While the order is still unpaid it can be
// corrected in place (a mis-tapped drink used to be impossible to undo):
// "Edit" reopens the addon sheet pre-filled (wrong topping — used to mean
// Hapus + tambah ulang), "− 1 porsi" for a multi-qty line, "Hapus" for the
// whole line. Deleting asks once inline (no extra sheet) since it's the
// destructive one; the server recomputes the order total either way.
function OrderItemRow({
  orderId,
  item,
  editable,
  canRemove,
  onChanged,
  onEdit,
}: {
  orderId: string;
  item: OrderDetailData["items"][number];
  editable: boolean;
  canRemove: boolean;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "one" | "all") {
    setBusy(true);
    setError(null);
    try {
      const result = await removeOrderItem(orderId, item.id, mode);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5 p-3">
      <div className="flex justify-between gap-3">
        <span className="text-base font-semibold text-ink">
          {item.qty}x {item.productName}
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

      {editable && !confirming && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {/* A custom item ("+ Item Custom") has no real Product behind it
              to reopen an addon sheet for — Hapus + tambah ulang covers the
              correction case instead (owner's scope, 22 Sep 2026). */}
          {!item.isCustom && (
            <Button variant="secondary" disabled={busy} onClick={onEdit}>
              Edit
            </Button>
          )}
          {canRemove && (
            <>
              {item.qty > 1 && (
                <Button variant="secondary" disabled={busy} onClick={() => run("one")}>
                  − 1 porsi
                </Button>
              )}
              <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>
                Hapus
              </Button>
            </>
          )}
        </div>
      )}
      {editable && confirming && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-ink text-sm font-medium">Hapus baris ini?</span>
          <Button variant="danger" disabled={busy} onClick={() => run("all")}>
            {busy ? "Menghapus..." : "Ya, hapus"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Batal
          </Button>
        </div>
      )}
      {error && <p className="text-danger mt-1 text-sm">{error}</p>}
    </div>
  );
}

export function OrderDetail({
  order,
  menu,
  packingList,
  printerDriver,
  nav,
  isOwner,
  cashDepositAvailable,
  autoPrintReceipt,
  kitchenTicketEnabled,
}: {
  order: OrderDetailData;
  menu: MenuCategory[];
  packingList: PackingListData | null;
  printerDriver: PrinterDriver;
  nav: HeaderNav;
  isOwner: boolean;
  // A cash DP needs an open shift (it goes into the drawer); QRIS never does.
  cashDepositAvailable: boolean;
  autoPrintReceipt: boolean;
  // Off (default, 22 Sep 2026): the "Cetak Tiket Dapur" button and the
  // TAMBAHAN prompt in AddItemsPanel don't show at all — CLAUDE.md "Kertas
  // dapur". This same button doubles as the pre-order's manual print (this
  // component IS the pre-order detail screen — pesanan-terjadwal-list.tsx
  // links here too).
  kitchenTicketEnabled: boolean;
}) {
  const router = useRouter();
  const [markingServed, setMarkingServed] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printingKitchenTicket, setPrintingKitchenTicket] = useState(false);
  const [kitchenTicketError, setKitchenTicketError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<OrderDetailData["items"][number] | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const { offer: offerKitchenTicket, prompt: kitchenTicketPrompt } = useKitchenTicketPrompt({ printerDriver });

  const allProducts = menu.flatMap((c) => c.products);
  const editingProduct: MenuProduct | undefined = editingItem
    ? allProducts.find((p) => p.id === editingItem.productId)
    : undefined;

  async function handleConfirmEdit(result: AddonSheetResult) {
    if (!editingItem || !editingProduct) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const editResult = await editOrderItem(order.id, editingItem.id, {
        productId: editingProduct.id,
        addonOptionIds: expandAddonOptionIds(result.addons),
        notes: result.notes,
        qty: result.qty,
      });
      if (!editResult.ok) {
        setEditError(editResult.error);
        return;
      }
      setEditingItem(null);
      router.refresh();
      if (kitchenTicketEnabled && editResult.kitchenTicket) offerKitchenTicket(editResult.kitchenTicket);
    } finally {
      setEditSaving(false);
    }
  }

  const canAddItems = order.status === "OPEN";
  const canEditItems = order.status === "OPEN";
  const canPay = order.status === "OPEN";
  // The last remaining portion can't be removed — an empty order is
  // "Batalkan Order" (with a reason), not a silent delete.
  const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);
  // Bungkus/Antar are marked served automatically at payment (payOrder), so
  // an unpaid one never needs the manual step — only Dine In does. A PAID
  // order still unserved (older data) keeps the button as a way out.
  const needsServing =
    !order.servedAt && (order.status === "OPEN" ? order.channel === "DINE_IN" : order.status === "PAID");
  const canPrintPackingList = order.status === "OPEN" && !!packingList;
  // Built client-side, straight from the order's own items — this is exactly
  // the "reprint" use case build-kitchen-ticket-data.ts's doc comment
  // describes. null (and the button hidden) when nothing on the order needs
  // the kitchen at all, or when the setting is off.
  const kitchenTicket = kitchenTicketEnabled
    ? buildKitchenTicketData(
        { queueNumber: order.queueNumber, queueSuffix: order.queueSuffix, channel: order.channel, tableLabel: order.tableLabel, customerName: order.customerName },
        order.items,
        "FULL",
      )
    : null;

  async function handlePrintKitchenTicket() {
    if (!kitchenTicket) return;
    setPrintingKitchenTicket(true);
    setKitchenTicketError(null);
    const failure = await printKitchenTicketSafely(printerDriver, kitchenTicket);
    setPrintingKitchenTicket(false);
    if (failure !== null) setKitchenTicketError(failure);
  }

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
    setPrinting(true);
    setPrintError(null);
    try {
      const printResult = await getPrinter(printerDriver).printPackingList(packingList);
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
          <div className="flex flex-col">
            {/* Same reading order as the cart and the struk, grouped per
                product on a big order (line-order.ts). */}
            <OrderLineList
              lines={sortOrderLines(order.items, portionPriceOf)}
              keyOf={(item) => item.id}
              divided
              inset="px-3"
              renderLine={(item) => (
                <OrderItemRow
                  orderId={order.id}
                  item={item}
                  editable={canEditItems}
                  canRemove={totalQty > 1}
                  onChanged={() => router.refresh()}
                  onEdit={() => {
                    setEditError(null);
                    setEditingItem(item);
                  }}
                />
              )}
            />
          </div>
          <div className="border-border bg-canvas rounded-b-card border-t px-3 py-2">
            <PortionTotalRow lines={order.items} className="mb-1" />
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-ink">Subtotal</span>
              <PriceText amount={order.subtotal} weight="total" />
            </div>
          </div>
        </Card>

        {(order.scheduledFor || order.deposits.length > 0) && (
          <DepositCard
            order={order}
            cashAvailable={cashDepositAvailable}
            autoPrint={autoPrintReceipt}
            printerDriver={printerDriver}
          />
        )}

        {canPrintPackingList && (
          <div className="mt-3">
            <Button variant="secondary" size="large" fullWidth onClick={handlePrintDaftar} disabled={printing}>
              {printing ? "Mencetak..." : "Print Daftar"}
            </Button>
            {printError && <p className="text-danger mt-1 text-sm">Print gagal: {printError}</p>}
          </div>
        )}

        {/* Manual, never a Ya/Tidak prompt — this is already an explicit tap.
            Doubles as the pre-order's "print on delivery day" button (this
            component is also the pre-order detail screen). */}
        {kitchenTicket && (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="large"
              fullWidth
              onClick={handlePrintKitchenTicket}
              disabled={printingKitchenTicket}
            >
              {printingKitchenTicket ? "Mencetak..." : "Cetak Tiket Dapur"}
            </Button>
            {kitchenTicketError && <p className="text-danger mt-1 text-sm">Print gagal: {kitchenTicketError}</p>}
          </div>
        )}

        {order.status === "OPEN" && order.deposits.length === 0 && (
          <div className="mt-3 flex justify-center">
            <SplitAndPayButton order={order} />
          </div>
        )}

        {canAddItems && (
          <div className="mt-3">
            <AddItemsPanel
              orderId={order.id}
              menu={menu}
              onAdded={() => router.refresh()}
              printerDriver={printerDriver}
              kitchenTicketEnabled={kitchenTicketEnabled}
            />
          </div>
        )}

        {order.status === "PAID" && isOwner && (
          <div className="mt-6">
            <VoidOrderButton
              orderId={order.id}
              orderLabel={order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : `No. ${order.orderNumber}`}
              total={order.total}
              paymentMethod={order.paymentMethod}
              splitCashAmount={order.splitCashAmount}
              splitQrisAmount={order.splitQrisAmount}
              shiftClosed={order.shiftStatus === "CLOSED"}
              onVoided={() => router.push(`/riwayat-pesanan/${order.id}`)}
            />
          </div>
        )}

        {order.status === "OPEN" && order.deposits.length === 0 && (
          <div className="mt-6">
            <CancelOrderButton
              orderId={order.id}
              orderLabel={order.queueNumber != null ? formatQueueLabel(order.queueNumber, order.queueSuffix) : null}
              onCancelled={() => router.push("/order-aktif")}
            />
          </div>
        )}

        {/* DP is real money: cancelling has to decide its fate, and only the
            owner may (the plain cancel refuses an order that holds DP). */}
        {order.status === "OPEN" && order.deposits.length > 0 && (
          <div className="mt-6">
            {isOwner ? (
              <CancelDepositOrderButton
                orderId={order.id}
                deposits={order.deposits}
                onCancelled={() => router.push("/order-aktif")}
              />
            ) : (
              <p className="text-ink-muted text-center text-sm">
                Pesanan ini sudah ada DP-nya — membatalkannya hanya bisa oleh pemilik.
              </p>
            )}
          </div>
        )}

        {order.status === "PAID" && (
          <div className="mt-3 flex justify-center">
            <Badge variant="success">
              Sudah dibayar ({formatPaymentMethodDetail(order.paymentMethod, order.splitCashAmount, order.splitQrisAmount)})
            </Badge>
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

      {kitchenTicketPrompt}

      {editingItem && !editingProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-card bg-surface shadow-sheet flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
            <p className="text-ink text-base font-semibold">
              Produk ini sudah tidak ada di menu, tidak bisa diedit. Hapus baris ini lalu tambahkan produk penggantinya.
            </p>
            <Button variant="secondary" fullWidth onClick={() => setEditingItem(null)}>
              Tutup
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingItem && editingProduct && (
          <AddonSheet
            product={editingProduct}
            initial={{
              addons: groupOrderItemAddons(editingItem.addons),
              notes: editingItem.notes ?? "",
              qty: editingItem.qty,
            }}
            onConfirm={handleConfirmEdit}
            onClose={() => !editSaving && setEditingItem(null)}
          />
        )}
      </AnimatePresence>
      {editError && editingItem && (
        <div className="fixed inset-x-0 bottom-0 z-[70] p-3">
          <div className="rounded-card bg-danger-soft mx-auto max-w-sm p-3 text-center">
            <p className="text-danger text-sm font-semibold">{editError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
