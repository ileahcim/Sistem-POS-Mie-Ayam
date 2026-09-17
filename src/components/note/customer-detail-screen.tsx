import type { MieCustomerDetail } from "@/lib/mie/get-mie-customer-detail";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { formatMieEntryLabel } from "@/lib/mie/types";
import { formatId } from "@/lib/timezone";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { EmptyState } from "@/components/ui/empty-state";
import { NoHistoryIcon } from "@/components/ui/empty-state-icons";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { cn } from "@/components/ui/cn";

// Ledger comes in oldest-first from getMieCustomerDetail (needed to
// accumulate runningBalance correctly) — reversed only here for newest-
// activity-first display, same convention as Riwayat Pesanan. Each row
// keeps its own already-computed runningBalance, so reversing for display
// never touches the numbers themselves.
export function CustomerDetailScreen({
  customer,
  orderAktifIndicator,
}: {
  customer: MieCustomerDetail;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const entriesNewestFirst = [...customer.entries].reverse();

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">{customer.name}</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton activeCount={orderAktifIndicator.activeCount} lateCount={orderAktifIndicator.lateCount} />
          <LinkButton href="/note" variant="secondary">
            Kembali
          </LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Card padded className="flex flex-col gap-1">
            <span className="text-ink-muted text-sm font-medium">Sisa utang saat ini</span>
            <PriceText amount={customer.balance} weight="total" />
            {customer.note && <span className="text-ink-faint text-sm">{customer.note}</span>}
          </Card>

          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/note/pesanan/baru?customerId=${customer.id}`} variant="primary">
              + Pesanan
            </LinkButton>
            <LinkButton href={`/note/pembayaran/baru?customerId=${customer.id}`} variant="secondary">
              + Pembayaran
            </LinkButton>
          </div>

          <Card>
            {entriesNewestFirst.length === 0 ? (
              <EmptyState icon={<NoHistoryIcon />} title="Belum ada transaksi" description="Pesanan dan pembayaran pelanggan ini akan muncul di sini." />
            ) : (
              entriesNewestFirst.map((e) => (
                <ListRow key={e.id} roomy>
                  <div className="flex-1">
                    <p className="text-ink-faint text-xs">{formatId(new Date(e.date), { dateStyle: "medium" })}</p>
                    <p className="text-ink text-base font-semibold">{formatMieEntryLabel(e)}</p>
                    {e.kind === "ORDER" && e.kg != null && e.pricePerKg != null && (
                      <p className="text-ink-muted text-sm">
                        {e.kg} kg × Rp{e.pricePerKg.toLocaleString("id-ID")}/kg
                      </p>
                    )}
                    {e.note && <p className="text-ink-faint text-xs">{e.note}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={cn(
                        "text-base font-bold tabular-nums",
                        e.kind === "PAYMENT" ? "text-primary-strong" : "text-ink",
                      )}
                    >
                      {e.kind === "PAYMENT" ? "-" : "+"}Rp{e.amount.toLocaleString("id-ID")}
                    </span>
                    <span className="text-ink-faint text-xs tabular-nums">
                      Saldo Rp{e.runningBalance.toLocaleString("id-ID")}
                    </span>
                  </div>
                </ListRow>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
