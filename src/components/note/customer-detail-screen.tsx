"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { MieCustomerDetail } from "@/lib/mie/get-mie-customer-detail";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { formatMieEntryLabel, mieEntryReducesDebt } from "@/lib/mie/types";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import { formatId } from "@/lib/timezone";
import { deleteMieCustomer, setMieCustomerActive } from "@/app/note/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NoHistoryIcon } from "@/components/ui/empty-state-icons";
import { AppHeader } from "@/components/ui/app-header";
import { cn } from "@/components/ui/cn";
import { AdjustmentSheet, EditCustomerSheet, EntrySheet } from "./mie-sheets";

type Entry = MieCustomerDetail["entries"][number];

// Ledger comes in oldest-first from getMieCustomerDetail (needed to
// accumulate runningBalance correctly) — reversed only here for newest-
// activity-first display, same convention as Riwayat Pesanan. Each row
// keeps its own already-computed runningBalance, so reversing for display
// never touches the numbers themselves. Tapping a row opens its edit/delete
// sheet; after any change the page re-reads, so every running balance
// after the edited row updates on its own.
export function CustomerDetailScreen({
  customer,
  nav,
}: {
  customer: MieCustomerDetail;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"edit" | "adjust" | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [confirm, setConfirm] = useState<"deactivate" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entriesNewestFirst = [...customer.entries].reverse();
  const canDeletePermanently = customer.entries.length === 0;

  async function handleSetActive(isActive: boolean) {
    setBusy(true);
    setError(null);
    const result = await setMieCustomerActive(customer.id, isActive);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setConfirm(null);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteMieCustomer(customer.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push("/note");
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title={customer.name}
        subtitle={customer.isActive ? undefined : <Badge variant="neutral">Nonaktif</Badge>}
        actions={
          <LinkButton href="/note" variant="secondary" size="compact">
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

          {customer.isActive ? (
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/note/pesanan/baru?customerId=${customer.id}`} variant="primary">
                + Pesanan
              </LinkButton>
              <LinkButton href={`/note/pembayaran/baru?customerId=${customer.id}`} variant="secondary">
                + Pembayaran
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

          <Card>
            {entriesNewestFirst.length === 0 ? (
              <EmptyState
                icon={<NoHistoryIcon />}
                title="Belum ada transaksi"
                description="Pesanan dan pembayaran pelanggan ini akan muncul di sini."
              />
            ) : (
              entriesNewestFirst.map((e) => {
                const reduces = mieEntryReducesDebt(e.kind);
                return (
                  <ListRow key={e.id} roomy onClick={() => setEditingEntry(e)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-faint text-xs">{formatId(new Date(e.date), { dateStyle: "medium" })}</p>
                      <p className="text-ink text-base font-semibold">{formatMieEntryLabel(e)}</p>
                      {e.kind === "ORDER" && e.kg != null && e.pricePerKg != null && (
                        <p className="text-ink-muted text-sm">
                          {e.kg.toLocaleString("id-ID")} kg × Rp{e.pricePerKg.toLocaleString("id-ID")}/kg
                        </p>
                      )}
                      {e.kind === "PAYMENT" && (
                        <p className={cn("text-sm", e.paymentMethod ? "text-ink-muted" : "text-ink-faint italic")}>
                          {formatNotePaymentMethod(e.paymentMethod)}
                        </p>
                      )}
                      {e.note && <p className="text-ink-faint text-xs">{e.note}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        className={cn("text-base font-bold tabular-nums", reduces ? "text-primary-strong" : "text-ink")}
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
        {sheet === "edit" && <EditCustomerSheet key="edit" customer={customer} onClose={() => setSheet(null)} />}
        {sheet === "adjust" && (
          <AdjustmentSheet key="adjust" customerId={customer.id} onClose={() => setSheet(null)} />
        )}
        {editingEntry && (
          <EntrySheet key={editingEntry.id} entry={editingEntry} onClose={() => setEditingEntry(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
