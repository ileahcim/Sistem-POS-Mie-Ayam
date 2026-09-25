import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { MieSummary } from "@/lib/mie/get-mie-summary";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { buttonClassName } from "@/components/ui/button-styles";
import { CustomerList } from "./customer-list";
import { NoteNav } from "./note-nav";
import { NOTE_BOOK } from "@/lib/note/books";

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card padded className="flex min-w-[9.5rem] flex-1 flex-col gap-1">
      <span className="text-ink-muted text-xs font-medium">{label}</span>
      <span className="text-ink text-xl font-bold tabular-nums">{value}</span>
      {detail && <span className="text-warning text-xs font-medium">{detail}</span>}
    </Card>
  );
}

// Utang tab of the raw-noodle ledger — fully separate from the cashier
// system (money here never touches Shift/Order/omzet): who owes what, plus
// "+ Pesanan"/"+ Bayar" per customer. Recording from scratch lives on the
// Hari Ini tab (note-today-screen.tsx).
export function NoteScreen({
  customers,
  summary,
  nav,
}: {
  customers: MieCustomerRow[];
  summary: MieSummary;
  nav: HeaderNav;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title={NOTE_BOOK.mie.title} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <NoteNav book="mie" section="utang" />

          <div className="flex flex-wrap gap-3">
            <SummaryCard
              label="Total Piutang"
              value={`Rp${summary.totalReceivable.toLocaleString("id-ID")}`}
              detail={
                summary.inactiveReceivable > 0
                  ? `Rp${summary.inactiveReceivable.toLocaleString("id-ID")} dari pelanggan nonaktif`
                  : undefined
              }
            />
            <SummaryCard
              label="Pelanggan Menunggak"
              value={String(summary.debtorCount)}
              detail={summary.inactiveDebtorCount > 0 ? `${summary.inactiveDebtorCount} nonaktif` : undefined}
            />
            <SummaryCard
              label="Utang Tertua"
              value={summary.oldestDebtDays != null ? `${summary.oldestDebtDays} hari` : "—"}
            />
          </div>

          {/* Setup and export sit here with the customers they concern — the
              Hari Ini tab stays clean for recording. */}
          <div className="flex flex-wrap gap-2">
            <LinkButton href={NOTE_BOOK.mie.newCustomerHref} variant="secondary" className="border-border border">
              + Pelanggan
            </LinkButton>
            <LinkButton href="/note/produk" variant="ghost">
              Harga Produk
            </LinkButton>
            <a href={NOTE_BOOK.mie.exportHref} className={buttonClassName("ghost", "default", false)}>
              Export Excel
            </a>
          </div>

          <CustomerList customers={customers} />
        </div>
      </div>
    </div>
  );
}
