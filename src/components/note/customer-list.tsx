"use client";

import { useMemo, useState } from "react";
import type { MieCustomerRow } from "@/lib/mie/get-mie-customers";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { EmptyState } from "@/components/ui/empty-state";
import { NoMieCustomerIcon } from "@/components/ui/empty-state-icons";
import { cn } from "@/components/ui/cn";

type SortMode = "debt" | "name";

const SORT_LABEL: Record<SortMode, string> = { debt: "Utang terbesar", name: "Nama A-Z" };

function sortRows(rows: MieCustomerRow[], mode: SortMode): MieCustomerRow[] {
  const copy = [...rows];
  if (mode === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  else copy.sort((a, b) => b.balance - a.balance);
  return copy;
}

function CustomerRows({ rows }: { rows: MieCustomerRow[] }) {
  return rows.map((c) => (
    <ListRow key={c.id} roomy asLink={`/note/pelanggan/${c.id}`}>
      <div className="min-w-0 flex-1">
        <p className="text-ink text-base font-semibold">{c.name}</p>
        {c.note && <p className="text-ink-muted text-sm">{c.note}</p>}
      </div>
      <PriceText amount={c.balance} weight="primary" />
    </ListRow>
  ));
}

// Search filters as you type (name or keterangan, case-insensitive); the
// sort toggle is purely client-side over the list the page already loaded.
// Nonaktif customers never mix into the main list — they sit in their own
// collapsed section so their history stays one tap away.
export function CustomerList({ customers }: { customers: MieCustomerRow[] }) {
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
