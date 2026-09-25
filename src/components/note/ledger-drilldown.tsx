"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatId } from "@/lib/timezone";

// One row of the drill-down list that opens under a Ringkasan stat card.
// Purely presentational: the screen that renders it has already decided
// which ledger rows belong in the list (they come straight out of the same
// bucket the card's number was summed from), what each row emphasises
// (rupiah for Omzet, kg/pcs for Mi terjual), and what Edit/Hapus do.
export type DrilldownRow = {
  id: string;
  href: string; // the customer's existing detail page
  title: string; // customer name
  date: string; // ISO business date
  time: string; // "HH:MM", when the row was recorded
  detail?: string | null; // e.g. "Mi Keriting · 10 kg × Rp15.000/kg"
  note?: string | null;
  value: string; // the emphasised number for this list
  sub?: string | null; // the other number, smaller
};

// Shared by Ringkasan Mi Mentah and Ringkasan Frozen. Each row has three
// independent targets — the row body navigates to the customer, Edit and
// Hapus open the book's own entry sheet (the SAME sheet, and so the same
// server action and validation, the customer page uses). They are siblings,
// never nested: a <Link> wrapping buttons would swallow their taps, and a
// motion wrapper that shrinks on press moves small buttons out from under
// the finger (CLAUDE.md "Design System > Animasi").
export function LedgerDrilldown({
  heading,
  rows,
  totalLabel,
  totalValue,
  emptyText,
  footnote,
  onEdit,
  onDelete,
  onClose,
}: {
  heading: string;
  rows: DrilldownRow[];
  totalLabel: string;
  totalValue: string;
  emptyText: string;
  footnote?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink text-base font-bold">{heading}</h2>
        <Button variant="secondary" size="compact" onClick={onClose}>
          Tutup
        </Button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="text-ink-muted px-4 py-8 text-center text-sm">{emptyText}</p>
        ) : (
          <>
            {rows.map((row) => (
              <div
                key={row.id}
                className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3"
              >
                <Link href={row.href} className="min-w-0 flex-1 basis-40">
                  <p className="text-ink truncate text-base font-semibold">{row.title}</p>
                  <p className="text-ink-faint text-xs">
                    {formatId(new Date(row.date), { dateStyle: "medium" })} · {row.time}
                  </p>
                  {row.detail && <p className="text-ink-muted text-sm">{row.detail}</p>}
                  {row.note && <p className="text-ink-faint text-xs">{row.note}</p>}
                </Link>

                <div className="ml-auto flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-ink text-base font-bold tabular-nums">{row.value}</span>
                    {row.sub && <span className="text-ink-faint text-xs tabular-nums">{row.sub}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="compact"
                      onClick={() => onEdit(row.id)}
                      aria-label={`Edit ${row.title} ${row.value}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="compact"
                      onClick={() => onDelete(row.id)}
                      aria-label={`Hapus ${row.title} ${row.value}`}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-ink text-sm font-bold">{totalLabel}</span>
              <span className="text-ink text-lg font-bold tabular-nums">{totalValue}</span>
            </div>
          </>
        )}
      </Card>

      {footnote && <p className="text-ink-faint text-xs">{footnote}</p>}
    </section>
  );
}

// The stat card itself, now a button that opens/closes its own list.
export function DrilldownStat({
  label,
  value,
  open,
  onToggle,
  warning,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  // e.g. Margin's "tanpa 3 pesanan (modal belum diisi)" — the number above
  // it is incomplete, and must say so right on the card.
  warning?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "rounded-card shadow-card flex min-w-[9.5rem] flex-1 flex-col gap-1 border p-4 text-left",
        open ? "border-primary bg-primary-soft" : "border-border bg-surface",
      )}
    >
      <span className="text-ink-muted text-xs font-medium">{label}</span>
      <span className="text-ink text-xl font-bold tabular-nums">{value}</span>
      {warning && <span className="text-warning text-xs font-semibold">{warning}</span>}
      <span className="text-ink-faint text-xs">{open ? "Tutup rincian" : "Ketuk untuk rincian"}</span>
    </button>
  );
}
