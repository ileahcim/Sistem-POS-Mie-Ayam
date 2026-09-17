import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { MieSummary } from "@/lib/mie/get-mie-summary";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { EmptyState } from "@/components/ui/empty-state";
import { NoMieCustomerIcon } from "@/components/ui/empty-state-icons";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { buttonClassName } from "@/components/ui/button-styles";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padded className="flex min-w-[9.5rem] flex-1 flex-col gap-1">
      <span className="text-ink-muted text-xs font-medium">{label}</span>
      <span className="text-ink text-xl font-bold tabular-nums">{value}</span>
    </Card>
  );
}

// Dashboard for the raw-noodle ledger module — fully separate from the
// cashier system (see CLAUDE.md-worthy brief: money here never touches
// Shift/Order/omzet). Quick actions up top since the owner records these
// standing in the production area — no digging through a nav to place an
// order or a payment.
export function NoteScreen({
  customers,
  summary,
  orderAktifIndicator,
}: {
  customers: MieCustomerRow[];
  summary: MieSummary;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Catatan Mi Mentah</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton activeCount={orderAktifIndicator.activeCount} lateCount={orderAktifIndicator.lateCount} />
          <LinkButton href="/kasir" variant="secondary">
            Ke Kasir
          </LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <SummaryCard label="Total Piutang" value={`Rp${summary.totalReceivable.toLocaleString("id-ID")}`} />
            <SummaryCard label="Pelanggan Menunggak" value={String(summary.debtorCount)} />
            <SummaryCard
              label="Utang Tertua"
              value={summary.oldestDebtDays != null ? `${summary.oldestDebtDays} hari` : "—"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton href="/note/pesanan/baru" variant="primary">
              + Pesanan
            </LinkButton>
            <LinkButton href="/note/pembayaran/baru" variant="secondary">
              + Pembayaran
            </LinkButton>
            <LinkButton href="/note/pelanggan/baru" variant="secondary">
              + Pelanggan
            </LinkButton>
            <LinkButton href="/note/produk" variant="ghost">
              Harga Produk
            </LinkButton>
            <a href="/note/export" className={buttonClassName("ghost", "default", false)}>
              Export Excel
            </a>
          </div>

          <Card>
            {customers.length === 0 ? (
              <EmptyState
                icon={<NoMieCustomerIcon />}
                title="Belum ada pelanggan"
                description="Tambahkan pelanggan mi mentah pertama untuk mulai mencatat pesanan dan pembayaran."
                actionHref="/note/pelanggan/baru"
                actionLabel="+ Pelanggan"
              />
            ) : (
              customers.map((c) => (
                <ListRow key={c.id} roomy asLink={`/note/pelanggan/${c.id}`}>
                  <div className="flex-1">
                    <p className="text-ink text-base font-semibold">{c.name}</p>
                    {c.note && <p className="text-ink-muted text-sm">{c.note}</p>}
                  </div>
                  <PriceText amount={c.balance} weight="primary" />
                </ListRow>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
