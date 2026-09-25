"use client";

import { formatRupiah } from "@/lib/printing/format";
import { CASH_TENDERED_PRESETS, changeFor } from "@/lib/orders/cash-change";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";

// "Uang diterima" + the change, big ("Hitung kembalian", 26 Sep 2026). Used
// wherever full cash is taken: Pembayaran (ordinary, sisa DP, piutang
// settlement) and "Catat DP". `due` is what THIS payment charges; the caller
// keeps its pay button off until value >= due. Quick buttons replace the
// value (they don't add up); one below `due` can't be right, so it's off.
export function CashTenderedField({
  due,
  value,
  onChange,
  id = "cash-tendered",
}: {
  due: number;
  value: number | "";
  onChange: (value: number | "") => void;
  id?: string;
}) {
  const amount = typeof value === "number" ? value : 0;
  const entered = amount > 0;
  const short = entered && amount < due;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-ink-muted text-sm font-medium">
        Uang diterima
      </label>
      <RupiahInput id={id} value={value} onChange={(v) => onChange(v > 0 ? v : "")} placeholder="0" className="h-12 text-base" />
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Pilih cepat uang diterima">
        {[{ label: "Uang pas", preset: due }, ...CASH_TENDERED_PRESETS.map((p) => ({ label: `${p / 1000}rb`, preset: p }))].map(
          ({ label, preset }) => (
            <button
              key={label}
              type="button"
              disabled={preset < due}
              aria-pressed={value === preset}
              onClick={() => onChange(preset)}
              className={cn(
                "rounded-pill h-12 px-2 text-sm font-semibold disabled:opacity-40",
                value === preset ? "bg-primary text-white" : "bg-muted text-ink",
              )}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <div
        className={cn(
          "rounded-card flex min-h-16 items-center justify-between gap-3 px-4 py-2",
          short ? "bg-danger-soft" : entered ? "bg-primary-soft" : "bg-muted",
        )}
        aria-live="polite"
      >
        {short ? (
          <>
            <span className="text-danger text-base font-bold">Kurang</span>
            <span className="text-danger text-2xl font-bold tabular-nums">{formatRupiah(due - amount)}</span>
          </>
        ) : entered ? (
          <>
            <span className="text-ink text-base font-bold">Kembalian</span>
            <span className="text-ink text-3xl font-bold tabular-nums" data-testid="change-amount">
              {formatRupiah(changeFor(amount, due))}
            </span>
          </>
        ) : (
          <span className="text-ink-muted text-sm">Isi uang yang diterima untuk melihat kembalian.</span>
        )}
      </div>
    </div>
  );
}
