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
import { validateSplitCashAmount } from "@/lib/orders/validate-split-payment";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { validateCashTendered } from "@/lib/orders/cash-change";
import { CashTenderedField } from "./cash-tendered-field";
import { payLater, payOrder, type PaymentMethod } from "@/app/pembayaran/actions";

// Cash, QRIS, or both at once ("Cash + QRIS" — CLAUDE.md-worthy brief, 22
// Sep 2026, for a customer whose cash falls short). With "Hitung kembalian"
// on (Setting.cashChangeEnabled, 26 Sep 2026) full Cash also asks "Uang
// diterima" and shows the change — a note only, the drawer still counts the
// total. Off: "tap method, tap Bayar" exactly as before. QRIS never asks;
// Cash + QRIS asks for its cash slice (that IS what goes into the drawer).
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "QRIS", label: "QRIS" },
  { value: "SPLIT", label: "Cash + QRIS" },
];

// "Belum Bayar" (25 Sep 2026): the fourth choice beside the three methods,
// for a customer the cashier KNOWS will pay later — the order becomes a
// piutang right away (the same markOrderReceivable path Tutup Shift uses),
// instead of being pushed through as QRIS to keep it out of the drawer.
type Choice = PaymentMethod | "LATER";

const SPLIT_CASH_PRESETS = [10000, 20000, 50000];

export function PembayaranScreen({
  order,
  menu,
  autoPrintReceipt,
  printerDriver,
  nav,
  kitchenTicketEnabled,
  cashChangeEnabled,
}: {
  order: OrderDetail;
  menu: MenuCategory[];
  autoPrintReceipt: boolean;
  printerDriver: PrinterDriver;
  nav: HeaderNav;
  kitchenTicketEnabled: boolean;
  cashChangeEnabled: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const method: PaymentMethod | null = choice === "LATER" ? null : choice;
  // "Belum Bayar": who owes it — prefilled with the guest name when there is one.
  const [debtorName, setDebtorName] = useState(order.customerName ?? "");
  // Settling a piutang with cash: did the money go into the drawer or into
  // the owner's pocket? No default — a wrong guess silently skews the drawer.
  const [cashToDrawer, setCashToDrawer] = useState<boolean | null>(null);
  // Cash slice of a split payment — the only number the cashier ever types
  // here; the QRIS slice is always derived (amountDue - this), never typed.
  const [splitCash, setSplitCash] = useState<number | "">("");
  // "Uang diterima" for full Cash — see CashTenderedField.
  const [tendered, setTendered] = useState<number | "">("");
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
  // "+ Tambah Item" open: its Batal / Tambah bar replaces Bayar in the bottom
  // bar (add-items-panel.tsx) — paying with picked items unsaved is impossible.
  const [addingItems, setAddingItems] = useState(false);
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null);

  // RECEIVABLE (piutang) is still payable — settling it later is the whole
  // point. Only PAID/VOID actually block the payment UI.
  const alreadyPaid = order.status !== "OPEN" && order.status !== "RECEIVABLE";
  const settlingReceivable = order.status === "RECEIVABLE";
  // Offered only for an ordinary unpaid order: not when settling a piutang
  // (it already is one), and not with DP (the server refuses — DP money must
  // be settled, never parked as a piutang).
  const canPayLater = order.status === "OPEN" && order.deposits.length === 0;

  // A pre-order that took DP: only the remainder is collected here. When the DP
  // already covers everything (or the order shrank below it) there is nothing to
  // collect, so no method has to be picked — and a leftover DP is shown as
  // "Kembalikan Rp X", never as a silent zero.
  const hasDeposit = order.deposits.length > 0;
  const nothingToCollect = hasDeposit && order.amountDue === 0;
  // What's actually being collected right now — the full total normally, or
  // just the sisa when a DP already covers part of it.
  const amountDue = hasDeposit ? order.amountDue : order.total;
  const splitCashError =
    method === "SPLIT" ? validateSplitCashAmount(typeof splitCash === "number" ? splitCash : NaN, amountDue) : null;
  const splitQris = method === "SPLIT" && typeof splitCash === "number" ? Math.max(0, amountDue - splitCash) : 0;
  const cashLike = method === "CASH" || method === "SPLIT";
  const needsDrawerChoice = settlingReceivable && cashLike;
  const asksTendered = cashChangeEnabled && method === "CASH" && !nothingToCollect;
  const tenderedOk = typeof tendered === "number" && validateCashTendered(tendered, amountDue) === null;
  const canPay =
    choice === "LATER"
      ? debtorName.trim() !== ""
      : (nothingToCollect || !!method) &&
        (method !== "SPLIT" || splitCashError === null) &&
        (!needsDrawerChoice || cashToDrawer !== null) &&
        (!asksTendered || tenderedOk);
  const payLabel = choice === "LATER"
    ? `Simpan sebagai Piutang - ${formatRupiah(order.total)}`
    : settlingReceivable
      ? `Lunasi Piutang - ${formatRupiah(order.total)}`
      : !hasDeposit
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
      const result =
        choice === "LATER"
          ? await payLater(order.id, debtorName)
          : await payOrder(
              order.id,
              method ?? "CASH",
              asksTendered ? (tendered as number) : null,
              method === "SPLIT" ? (splitCash as number) : null,
              needsDrawerChoice ? cashToDrawer : null,
            );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (autoPrintReceipt) {
        const failure = await tryPrint(result.receipt);
        if (failure === null) {
          router.push(doneHref);
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
    router.push(doneHref);
  }

  // Settling a piutang starts from the Piutang page — go back there.
  const doneHref = settlingReceivable ? "/piutang" : "/order-aktif";

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
            {choice === "LATER" ? (
              <Badge variant="warning">Tersimpan sebagai piutang — belum lunas</Badge>
            ) : (
              <Badge variant="success">Pembayaran berhasil</Badge>
            )}
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
                <AddItemsPanel
                  orderId={order.id}
                  menu={menu}
                  onAdded={() => router.refresh()}
                  printerDriver={printerDriver}
                  kitchenTicketEnabled={kitchenTicketEnabled}
                  footer={footerEl}
                  onOpenChange={setAddingItems}
                />
              </div>
            )}

            {order.status === "OPEN" && !hasDeposit && (
              <div className="mt-3 flex justify-center">
                <SplitAndPayButton order={order} />
              </div>
            )}

            {settlingReceivable && (
              <p className="text-warning mt-4 text-sm font-semibold">
                Pelunasan piutang{order.customerName ? ` atas nama ${order.customerName}` : ""} — dihitung ke shift
                yang sedang buka.
              </p>
            )}

            {nothingToCollect ? (
              <p className="text-ink-muted mt-4 text-center text-sm">
                {order.refundDue > 0
                  ? `DP lebih besar dari total pesanan — kembalikan ${formatRupiah(order.refundDue)} ke pelanggan, lalu tekan Selesai.`
                  : "DP sudah menutup seluruh pesanan — tidak ada yang perlu dibayar lagi."}
              </p>
            ) : (
            <div
              className={cn("mt-4 grid gap-2", canPayLater ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}
              role="group"
              aria-label="Metode bayar"
            >
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={choice === m.value}
                  onClick={() => setChoice(m.value)}
                  className={cn(
                    "rounded-pill h-12 text-base font-semibold",
                    choice === m.value ? "bg-primary text-white" : "bg-muted text-ink",
                  )}
                >
                  {m.label}
                </button>
              ))}
              {canPayLater && (
                <button
                  type="button"
                  aria-pressed={choice === "LATER"}
                  onClick={() => setChoice("LATER")}
                  className={cn(
                    "rounded-pill h-12 text-base font-semibold",
                    choice === "LATER" ? "bg-warning text-white" : "bg-warning-soft text-warning",
                  )}
                >
                  Belum Bayar
                </button>
              )}
            </div>
            )}

            {choice === "LATER" && (
              <div className="mt-3 flex flex-col gap-2">
                <label htmlFor="debtor-name" className="text-ink-muted text-sm font-medium">
                  Nama yang berutang (wajib)
                </label>
                <input
                  id="debtor-name"
                  type="text"
                  value={debtorName}
                  onChange={(e) => setDebtorName(e.target.value)}
                  placeholder="Mis. Rose KMK"
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
                <p className="text-ink-muted text-sm">
                  Pelanggan bayar nanti. Order jadi <strong>Piutang</strong> sekarang juga — tidak masuk laci maupun
                  omzet hari ini sampai dilunasi dari halaman Piutang. Struknya tertulis &ldquo;BELUM LUNAS&rdquo;.
                </p>
              </div>
            )}

            {needsDrawerChoice && (
              <div className="mt-3 flex flex-col gap-2">
                <span className="text-ink-muted text-sm font-medium">Uang tunainya masuk ke mana?</span>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Uang tunai masuk ke">
                  <button
                    type="button"
                    aria-pressed={cashToDrawer === true}
                    onClick={() => setCashToDrawer(true)}
                    className={cn(
                      "rounded-card flex min-h-14 flex-col items-start justify-center border px-3 py-2 text-left",
                      cashToDrawer === true ? "border-primary bg-primary-soft" : "border-border",
                    )}
                  >
                    <span className="text-ink text-sm font-bold">Masuk laci</span>
                    <span className="text-ink-muted text-xs">Ikut dihitung di hitung kas shift ini</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={cashToDrawer === false}
                    onClick={() => setCashToDrawer(false)}
                    className={cn(
                      "rounded-card flex min-h-14 flex-col items-start justify-center border px-3 py-2 text-left",
                      cashToDrawer === false ? "border-primary bg-primary-soft" : "border-border",
                    )}
                  >
                    <span className="text-ink text-sm font-bold">Masuk kantong</span>
                    <span className="text-ink-muted text-xs">Dicatat saja, tidak dihitung di laci</span>
                  </button>
                </div>
              </div>
            )}

            {asksTendered && (
              <div className="mt-3">
                <CashTenderedField due={amountDue} value={tendered} onChange={setTendered} />
              </div>
            )}

            {method === "SPLIT" && (
              <div className="mt-3 flex flex-col gap-2">
                <span className="text-ink-muted text-sm font-medium">Jumlah tunai</span>
                <RupiahInput value={splitCash} onChange={setSplitCash} placeholder="0" className="h-12 text-base" />
                <div className="flex flex-wrap gap-2">
                  {SPLIT_CASH_PRESETS.filter((p) => p < amountDue).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSplitCash(preset)}
                      aria-pressed={splitCash === preset}
                      className={cn(
                        "rounded-pill h-11 px-4 text-sm font-semibold",
                        splitCash === preset ? "bg-primary text-white" : "bg-muted text-ink",
                      )}
                    >
                      {preset / 1000}rb
                    </button>
                  ))}
                </div>
                {splitCashError ? (
                  <p className="text-danger text-sm">{splitCashError}</p>
                ) : (
                  typeof splitCash === "number" &&
                  splitCash > 0 && (
                    <p className="text-ink-muted text-sm">
                      Tunai {formatRupiah(splitCash)} · QRIS {formatRupiah(splitQris)}
                    </p>
                  )
                )}
              </div>
            )}

            {error && <p className="text-danger mt-3 text-sm">{error}</p>}
          </>
        )}
      </div>

      {!alreadyPaid && !pendingReceipt && (
        <div className="border-border bg-surface flex border-t p-4">
          {!addingItems && (
            <Button variant="primary" size="large" fullWidth disabled={!canPay || paying} onClick={handlePay}>
              {paying ? "Memproses..." : payLabel}
            </Button>
          )}
          <div ref={setFooterEl} className="contents" />
        </div>
      )}
    </div>
  );
}
