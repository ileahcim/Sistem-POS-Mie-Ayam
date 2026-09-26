"use client";

import { useMemo, useState } from "react";
import type { FrozenCustomerRow } from "@/lib/frozen/get-frozen-customers";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { EmptyState } from "@/components/ui/empty-state";
import { NoMieCustomerIcon } from "@/components/ui/empty-state-icons";
import { cn } from "@/components/ui/cn";

type SortMode = "debt" | "name";

const SORT_LABEL: Record<SortMode, string> = { debt: "Utang terbesar", name: "Nama A-Z" };

function sortRows(rows: FrozenCustomerRow[], mode: SortMode): FrozenCustomerRow[] {
  const copy = [...rows];
  if (mode === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  else copy.sort((a, b) => b.balance - a.balance);
  return copy;
}

// Mirrors customer-list.tsx exactly, pointed at the Frozen buku's own routes.
function CustomerRows({ rows }: { rows: FrozenCustomerRow[] }) {
  return rows.map((c) => (
    <div
      key={c.id}
      className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-b-0"
    >
      <Link href={`/note/frozen/pelanggan/${c.id}`} className="flex min-h-12 min-w-[12rem] flex-1 items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="text-ink block text-base font-semibold">{c.name}</span>
          {c.note && <span className="text-ink-muted block text-sm">{c.note}</span>}
        </span>
        <PriceText amount={c.balance} weight="primary" />
      </Link>
      {c.isActive && (
        <div className="flex shrink-0 gap-2">
          <LinkButton href={`/note/frozen/pengambilan/baru?customerId=${c.id}&dari=utang`} variant="ghost">
            + Pengambilan
          </LinkButton>
          <LinkButton href={`/note/frozen/pembayaran/baru?customerId=${c.id}&dari=utang`} variant="secondary">
            + Bayar
          </LinkButton>
          {/* Retur is rare: on a phone it lives on the customer page only, so
              this row keeps two buttons that fit. */}
          <span className="hidden md:contents">
            <LinkButton href={`/note/frozen/retur/baru?customerId=${c.id}&dari=utang`} variant="ghost">
              + Retur
            </LinkButton>
          </span>
        </div>
      )}
    </div>
  ));
}

export function FrozenCustomerList({ customers }: { customers: FrozenCustomerRow[] }) {
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
        <label htmlFor="frozen-customer-search" className="sr-only">
          Cari pelanggan
        </label>
        <input
          id="frozen-customer-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama pelanggan"
          className="rounded-input border-border bg-surface h-12 min-w-48 flex-1 border px-3 text-base"
        />
        <div className="rounded-pill bg-muted flex h-12 items-center p-1" role="group" aria-label="Urutan">
          {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={sort === mode}
              onClick={() => setSort(mode)}
              className={cn(
                "rounded-pill h-10 px-4 text-sm font-semibold",
                sort === mode ? "bg-surface text-ink shadow-card" : "text-ink-muted",
              )}
            >
              {SORT_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {!hasAnyActive ? (
          <EmptyState
            icon={<NoMieCustomerIcon />}
            title="Belum ada pelanggan"
            description="Tambahkan pelanggan Frozen pertama untuk mulai mencatat pengambilan dan pembayaran."
            actionHref="/note/frozen/pelanggan/baru"
            actionLabel="+ Pelanggan"
          />
        ) : active.length === 0 ? (
          <p className="text-ink-faint p-6 text-center text-sm">Tidak ada pelanggan yang cocok dengan “{query}”.</p>
        ) : (
          <CustomerRows rows={active} />
        )}
      </Card>

      {inactive.length > 0 && (
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
