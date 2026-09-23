import Link from "next/link";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import type { MieSummary } from "@/lib/mie/get-mie-summary";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { buttonClassName } from "@/components/ui/button-styles";
import { CustomerList } from "./customer-list";
import { NoteBookTabs } from "./note-book-tabs";

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card padded className="flex min-w-[9.5rem] flex-1 flex-col gap-1">
      <span className="text-ink-muted text-xs font-medium">{label}</span>
      <span className="text-ink text-xl font-bold tabular-nums">{value}</span>
      {detail && <span className="text-warning text-xs font-medium">{detail}</span>}
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
  nav,
}: {
  customers: MieCustomerRow[];
  summary: MieSummary;
  nav: HeaderNav;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Catatan Mi Mentah" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <NoteBookTabs active="mie" />
          {/* The door to the monitoring screen — first thing on the page and
              visually lifted, since as a plain ghost button in the row of
              actions below it read as just another small link. */}
          <Link
            href="/note/ringkasan"
            className="rounded-card border-primary bg-primary-soft flex min-h-16 items-center gap-3 border-2 px-4 py-3"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-ink text-base font-bold">Ringkasan</span>
              <span className="text-ink-muted text-sm">Omzet, pembayaran, dan rincian per jenis mi</span>
            </span>
            <span className="text-primary-strong text-xl font-bold">›</span>
          </Link>

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

          <div className="flex flex-wrap gap-2">
            {/* The grey buttons blended into the page background, so every
                non-primary one here carries a visible border now. */}
            <LinkButton href="/note/pesanan/baru" variant="primary">
              + Pesanan
            </LinkButton>
            <LinkButton href="/note/pembayaran/baru" variant="secondary" className="border-border border">
              + Pembayaran
            </LinkButton>
            <LinkButton href="/note/pelanggan/baru" variant="secondary" className="border-border border">
              + Pelanggan
            </LinkButton>
            <LinkButton href="/note/produk" variant="ghost">
              Harga Produk
            </LinkButton>
            <a href="/note/export" className={buttonClassName("ghost", "default", false)}>
              Export Excel
            </a>
          </div>

          <CustomerList customers={customers} />
        </div>
      </div>
    </div>
  );
}
