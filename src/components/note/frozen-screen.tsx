import type { TodayActivityRow } from "@/lib/note/today-activity";
import Link from "next/link";
import type { FrozenCustomerRow } from "@/lib/frozen/get-frozen-customers";
import type { FrozenSummary } from "@/lib/frozen/get-frozen-summary";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { buttonClassName } from "@/components/ui/button-styles";
import { FrozenCustomerList } from "./frozen-customer-list";
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

// Home screen for the Buku Frozen — a fully separate ledger from Mi Mentah
// and from the POS itself (CLAUDE.md-worthy brief "Buku Frozen Terpisah", 22
// Sep 2026). Mirrors note-screen.tsx's shape exactly.
export function FrozenScreen({
  customers,
  todayActivity,
  summary,
  nav,
}: {
  customers: FrozenCustomerRow[];
  todayActivity: TodayActivityRow[];
  summary: FrozenSummary;
  nav: HeaderNav;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Buku Frozen" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <NoteBookTabs active="frozen" />

          <Link
            href="/note/frozen/ringkasan"
            className="rounded-card border-primary bg-primary-soft flex min-h-16 items-center gap-3 border-2 px-4 py-3"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-ink text-base font-bold">Ringkasan</span>
              <span className="text-ink-muted text-sm">Omzet, pembayaran, dan pcs terjual</span>
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
            <LinkButton href="/note/frozen/pengambilan/baru" variant="primary">
              + Pengambilan
            </LinkButton>
            <LinkButton href="/note/frozen/pembayaran/baru" variant="secondary" className="border-border border">
              + Pembayaran
            </LinkButton>
            <LinkButton href="/note/frozen/pelanggan/baru" variant="secondary" className="border-border border">
              + Pelanggan
            </LinkButton>
            <LinkButton href="/note/produk" variant="ghost">
              Harga Produk
            </LinkButton>
            <a href="/note/frozen/export" className={buttonClassName("ghost", "default", false)}>
              Export Excel
            </a>
          </div>

          <FrozenCustomerList customers={customers} todayActivity={todayActivity} />
        </div>
      </div>
    </div>
  );
}
