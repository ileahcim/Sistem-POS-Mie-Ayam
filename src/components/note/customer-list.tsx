"use client";

import { useMemo, useState } from "react";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { EmptyState } from "@/components/ui/empty-state";
import { NoMieCustomerIcon } from "@/components/ui/empty-state-icons";
import { cn } from "@/components/ui/cn";
import type { TodayActivityRow } from "@/lib/note/today-activity";
import { TodayActivityList } from "./today-activity-list";

// "today" isn't a sort — it swaps the customer list for every transaction
// recorded today (TodayActivityList), sitting in the same toggle so it's one
// tap from the list the owner already has open.
type SortMode = "debt" | "name" | "today";

const SORT_LABEL: Record<SortMode, string> = { debt: "Utang terbesar", name: "Nama A-Z", today: "Aktivitas Hari Ini" };

function sortRows(rows: MieCustomerRow[], mode: SortMode): MieCustomerRow[] {
  const copy = [...rows];
  if (mode === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  else copy.sort((a, b) => b.balance - a.balance);
  return copy;
}

// Each card: the name/balance area opens the customer page; active
// customers also get "+ Pesanan" / "+ Bayar" right on the card, landing on
// the form with this customer already selected — no detour via the detail
// page when recording standing up.
function CustomerRows({ rows }: { rows: MieCustomerRow[] }) {
  return rows.map((c) => (
    <div
      key={c.id}
      className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-b-0"
    >
      <Link href={`/note/pelanggan/${c.id}`} className="flex min-h-12 min-w-[12rem] flex-1 items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="text-ink block text-base font-semibold">{c.name}</span>
          {c.note && <span className="text-ink-muted block text-sm">{c.note}</span>}
        </span>
        <PriceText amount={c.balance} weight="primary" />
      </Link>
      {c.isActive && (
        <div className="flex shrink-0 gap-2">
          <LinkButton href={`/note/pesanan/baru?customerId=${c.id}`} variant="ghost">
            + Pesanan
          </LinkButton>
          <LinkButton href={`/note/pembayaran/baru?customerId=${c.id}`} variant="secondary">
            + Bayar
          </LinkButton>
        </div>
      )}
    </div>
  ));
}

// Search filters as you type (name or keterangan, case-insensitive); the
// sort toggle is purely client-side over the list the page already loaded.
// Nonaktif customers never mix into the main list — they sit in their own
// collapsed section so their history stays one tap away.
export function CustomerList({
  customers,
  todayActivity,
}: {
  customers: MieCustomerRow[];
  todayActivity: TodayActivityRow[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("debt");
  const [showInactive, setShowInactive] = useState(false);

  const { active, inactive } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.note ?? "").toLowerCase().includes(q))
      : customers;
    const sorted = sortRows(matches, sort);
    return { active: sorted.filter((c) => c.isActive), inactive: sorted.filter((c) => !c.isActive) };
  }, [customers, query, sort]);

  const hasAnyActive = customers.some((c) => c.isActive);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="mie-customer-search" className="sr-only">
          Cari pelanggan
        </label>
        <input
          id="mie-customer-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama pelanggan"
          className="rounded-input border-border bg-surface h-12 min-w-48 flex-1 border px-3 text-base"
        />
        {/* Three pills don't fit beside the search box on a phone: there the
            group takes its own full-width row, pills sharing it equally. */}
        <div
          className="rounded-pill bg-muted grid min-h-12 w-full grid-cols-3 items-center p-1 sm:flex sm:w-auto"
          role="group"
          aria-label="Urutan"
        >
          {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={sort === mode}
              onClick={() => setSort(mode)}
              className={cn(
                "rounded-pill min-h-10 px-2 text-sm leading-tight font-semibold sm:px-4",
                sort === mode ? "bg-surface text-ink shadow-card" : "text-ink-muted",
              )}
            >
              {SORT_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      {sort === "today" ? (
        <Card>
          <TodayActivityList rows={todayActivity} customerHref={(id) => `/note/pelanggan/${id}`} query={query} />
        </Card>
      ) : (
        <Card>
          {!hasAnyActive ? (
            <EmptyState
              icon={<NoMieCustomerIcon />}
              title="Belum ada pelanggan"
              description="Tambahkan pelanggan mi mentah pertama untuk mulai mencatat pesanan dan pembayaran."
              actionHref="/note/pelanggan/baru"
              actionLabel="+ Pelanggan"
            />
          ) : active.length === 0 ? (
            <p className="text-ink-faint p-6 text-center text-sm">Tidak ada pelanggan yang cocok dengan “{query}”.</p>
          ) : (
            <CustomerRows rows={active} />
          )}
        </Card>
      )}

      {sort !== "today" && inactive.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            aria-expanded={showInactive}
            className="text-ink-muted flex h-12 items-center gap-2 self-start text-sm font-semibold"
          >
            <span aria-hidden>{showInactive ? "▾" : "▸"}</span>
            Pelanggan nonaktif ({inactive.length})
          </button>
          {showInactive && (
            <Card className="opacity-80">
              <CustomerRows rows={inactive} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
