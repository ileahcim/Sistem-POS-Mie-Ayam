"use client";

import { cn } from "./cn";

function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

function toNumber(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

// Every amount-of-money input in the app (modal awal, pengeluaran, hitung
// kas fisik) goes through this — auto-formats thousands separators as the
// cashier types ("200000" -> "200.000") instead of showing raw digits.
// Value/onChange work in plain Rupiah numbers; the dot-formatting is purely
// display, applied on every keystroke.
export function RupiahInput({
  value,
  onChange,
  placeholder,
  className,
  id,
}: {
  value: number | "";
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="text-ink-muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value === "" ? "" : formatDigits(String(value))}
        onChange={(e) => onChange(toNumber(e.target.value))}
        placeholder={placeholder}
        className={cn("rounded-input border-border w-full border py-2 pl-11 pr-4 text-lg", className)}
      />
    </div>
  );
}
