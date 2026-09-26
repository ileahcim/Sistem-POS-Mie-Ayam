"use client";

import type { PosReceivableRow } from "@/lib/orders/get-pos-receivables-by-name";
import { PosReceivablesCard } from "./pos-receivables-card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { FrozenCustomerDetail } from "@/lib/frozen/get-frozen-customer-detail";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver } from "@/lib/printing/types";
import { formatFrozenEntryLabel, frozenEntryHasItems, frozenEntryReducesDebt } from "@/lib/frozen/types";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import { formatId } from "@/lib/timezone";
import { deleteFrozenCustomer, setFrozenCustomerActive } from "@/app/note/frozen-actions";
import { printFrozenReceiptSafely } from "@/lib/printing/print-frozen-receipt";
import { isWebBluetoothSupported } from "@/lib/printing/printers/web-bluetooth-printer";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NoHistoryIcon } from "@/components/ui/empty-state-icons";
import { AppHeader } from "@/components/ui/app-header";
import { noteSectionHref } from "@/lib/note/books";
import { cn } from "@/components/ui/cn";
import { EditFrozenCustomerSheet, FrozenAdjustmentSheet, FrozenEntrySheet } from "./frozen-sheets";

type Entry = FrozenCustomerDetail["entries"][number];

// Mirrors customer-detail-screen.tsx exactly, plus a per-row "Cetak Ulang"
// for a pickup/payment row (CLAUDE.md-worthy brief "Buku Frozen Terpisah",
// B3) — an explicit reprint tap prints immediately, no Ya/Tidak (same
// convention as the struk reprint in Riwayat Pesanan).
export function FrozenCustomerDetailScreen({
  customer,
  posReceivables,
  printerDriver,
  store,
  backHref,
  nav,
}: {
  posReceivables: PosReceivableRow[];
  customer: FrozenCustomerDetail;
  printerDriver: PrinterDriver;
  store: { storeName: string; address: string | null; phone: string | null; printLogo: boolean };
  backHref: string;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"edit" | "adjust" | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [confirm, setConfirm] = useState<"deactivate" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printingEntryId, setPrintingEntryId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  const entriesNewestFirst = [...customer.entries].reverse();
  const canDeletePermanently = customer.entries.length === 0;
  // The printer connects to the Android tablet over Web Bluetooth — Safari
  // on iPhone has no Web Bluetooth at all, so no reprint button that's
  // guaranteed to fail is ever shown here (owner's device constraint, 22
  // Sep 2026).
  const printingUnavailable = printerDriver === "webbluetooth" && !isWebBluetoothSupported();

  async function handleReprint(e: Entry) {
    setPrintingEntryId(e.id);
    setPrintError(null);
    const failure = await printFrozenReceiptSafely(printerDriver, {
      storeName: store.storeName,
      address: store.address,
      phone: store.phone,
      printLogo: store.printLogo,
      kind: e.kind === "ORDER" ? "PENGAMBILAN" : "PEMBAYARAN",
      customerName: customer.name,
      printedAt: new Date(e.date),
      pcs: e.pcs ?? undefined,
      pricePerPcs: e.pricePerPcs ?? undefined,
      pickupTotal: e.kind === "ORDER" ? e.amount : undefined,
      amountPaid: e.kind === "PAYMENT" ? e.amount : undefined,
      debtAfter: e.runningBalance,
    });
    setPrintingEntryId(null);
    if (failure !== null) setPrintError(failure);
  }

  async function handleSetActive(isActive: boolean) {
    setBusy(true);
    setError(null);
    const result = await setFrozenCustomerActive(customer.id, isActive);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setConfirm(null);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteFrozenCustomer(customer.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push(noteSectionHref("frozen", "utang"));
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title={customer.name}
        subtitle={customer.isActive ? undefined : <Badge variant="neutral">Nonaktif</Badge>}
        actions={
          <LinkButton href={backHref} variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Card padded className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Sisa utang saat ini</span>
              <PriceText amount={customer.balance} weight="total" />
              {customer.note && <span className="text-ink-faint text-sm">{customer.note}</span>}
            </div>
            <Button variant="secondary" onClick={() => setSheet("edit")}>
              Edit
            </Button>
          </Card>

          <PosReceivablesCard rows={posReceivables} />

          {customer.isActive ? (
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/note/frozen/pengambilan/baru?customerId=${customer.id}&dari=pelanggan`} variant="primary">
                + Pengambilan
              </LinkButton>
              <LinkButton href={`/note/frozen/pembayaran/baru?customerId=${customer.id}&dari=pelanggan`} variant="secondary">
                + Pembayaran
              </LinkButton>
              <LinkButton href={`/note/frozen/retur/baru?customerId=${customer.id}&dari=pelanggan`} variant="secondary">
                + Retur
              </LinkButton>
              <Button variant="secondary" onClick={() => setSheet("adjust")}>
                Koreksi Saldo
              </Button>
            </div>
          ) : (
            <Card padded className="bg-muted flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink text-sm">
                Pelanggan nonaktif — tidak bisa dipilih untuk transaksi baru. Riwayat tetap tersimpan.
              </p>
              <Button variant="primary" disabled={busy} onClick={() => handleSetActive(true)}>
                Aktifkan lagi
              </Button>
            </Card>
          )}

          {printingUnavailable && (
            <p className="text-ink-faint text-xs">
              Cetak ulang bukti cuma bisa dari tablet kasir (Bluetooth printer tidak tersedia di perangkat ini).
            </p>
          )}
          {printError && <p className="text-danger text-sm">Cetak gagal: {printError}</p>}

          <Card>
            {entriesNewestFirst.length === 0 ? (
              <EmptyState
                icon={<NoHistoryIcon />}
                title="Belum ada transaksi"
                description="Pengambilan dan pembayaran pelanggan ini akan muncul di sini."
              />
            ) : (
              entriesNewestFirst.map((e) => {
                const reduces = frozenEntryReducesDebt(e.kind);
                const isReturn = e.kind === "RETURN";
                const canReprint = (e.kind === "ORDER" || e.kind === "PAYMENT") && !printingUnavailable;
                return (
                  <ListRow key={e.id} roomy onClick={() => setEditingEntry(e)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-faint text-xs">{formatId(new Date(e.date), { dateStyle: "medium" })}</p>
                      {isReturn ? (
                        <p className="text-base font-semibold">
                          <Badge variant="warning">Retur</Badge>
                        </p>
                      ) : (
                        <p className="text-ink text-base font-semibold">{formatFrozenEntryLabel(e)}</p>
                      )}
                      {frozenEntryHasItems(e.kind) && e.pcs != null && e.pricePerPcs != null && (
                        <p className="text-ink-muted text-sm">
                          {e.pcs.toLocaleString("id-ID")} pcs × Rp{e.pricePerPcs.toLocaleString("id-ID")}/pcs
                        </p>
                      )}
                      {e.kind === "PAYMENT" && (
                        <p className={cn("text-sm", e.paymentMethod ? "text-ink-muted" : "text-ink-faint italic")}>
                          {formatNotePaymentMethod(e.paymentMethod)}
                        </p>
                      )}
                      {e.note && <p className="text-ink-faint text-xs">{e.note}</p>}
                      {canReprint && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleReprint(e);
                          }}
                          disabled={printingEntryId === e.id}
                          className="text-primary-strong mt-1 text-sm font-semibold underline"
                        >
                          {printingEntryId === e.id ? "Mencetak..." : "Cetak Ulang"}
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "text-base font-bold tabular-nums",
                          isReturn ? "text-warning" : reduces ? "text-primary-strong" : "text-ink",
                        )}
                      >
                        {reduces ? "-" : "+"}Rp{e.amount.toLocaleString("id-ID")}
                      </span>
                      <span className="text-ink-faint text-xs tabular-nums">
                        Saldo Rp{e.runningBalance.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </ListRow>
                );
              })
            )}
          </Card>

          <Card padded className="flex flex-col gap-3">
            <p className="text-ink text-sm font-bold">Kelola pelanggan</p>
            {confirm === null && (
              <div className="flex flex-wrap gap-2">
                {customer.isActive && (
                  <Button variant="secondary" onClick={() => setConfirm("deactivate")}>
                    Nonaktifkan
                  </Button>
                )}
                {canDeletePermanently && (
                  <Button variant="danger" onClick={() => setConfirm("delete")}>
                    Hapus Permanen
                  </Button>
                )}
              </div>
            )}
            {confirm === null && !canDeletePermanently && (
              <p className="text-ink-faint text-xs">
                Hapus permanen hanya untuk pelanggan yang belum punya transaksi sama sekali.
              </p>
            )}
            {confirm === "deactivate" && (
              <div className="flex flex-col gap-2">
                <p className="text-ink text-sm">
                  Nonaktifkan {customer.name}? Pelanggan hilang dari daftar utama dan tidak bisa dipilih untuk
                  transaksi baru. Riwayatnya tetap bisa dibuka.
                  {customer.balance !== 0 &&
                    ` Saldo Rp${customer.balance.toLocaleString("id-ID")} tetap tercatat dan tetap dihitung di Total Piutang (ditandai sebagai piutang pelanggan nonaktif).`}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" fullWidth onClick={() => setConfirm(null)}>
                    Tidak jadi
                  </Button>
                  <Button variant="danger" fullWidth disabled={busy} onClick={() => handleSetActive(false)}>
                    Ya, Nonaktifkan
                  </Button>
                </div>
              </div>
            )}
            {confirm === "delete" && (
              <div className="flex flex-col gap-2">
                <p className="text-ink text-sm">Hapus {customer.name} permanen? Tidak bisa dibatalkan.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" fullWidth onClick={() => setConfirm(null)}>
                    Tidak jadi
                  </Button>
                  <Button variant="danger" fullWidth disabled={busy} onClick={handleDelete}>
                    Ya, Hapus
                  </Button>
                </div>
              </div>
            )}
            {error && <p className="text-danger text-sm">{error}</p>}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {sheet === "edit" && <EditFrozenCustomerSheet key="edit" customer={customer} onClose={() => setSheet(null)} />}
        {sheet === "adjust" && (
          <FrozenAdjustmentSheet key="adjust" customerId={customer.id} onClose={() => setSheet(null)} />
        )}
        {editingEntry && (
          <FrozenEntrySheet
            key={editingEntry.id}
            entry={editingEntry}
            customer={{ id: customer.id, name: customer.name }}
            onClose={() => setEditingEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
