"use client";

import { cn } from "./cn";

// [ − ] qty [ + ] — the one way a qty is changed on a list of items (cart,
// "+ Tambah Item", a saved unpaid order). Both buttons are 48px (CLAUDE.md
// "UI": touch targets never below 48px). What "−" at qty 1 means is up to
// the caller: an unsaved line simply disappears, a saved one asks first.
export function QtyStepper({
  qty,
  onDecrement,
  onIncrement,
  disabled = false,
  decrementDisabled = false,
  incrementDisabled = false,
  label,
  className,
}: {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  disabled?: boolean;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  // Item name, for the screen-reader labels ("Kurangi Es Teh").
  label: string;
  className?: string;
}) {
  const buttonClass =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-2xl leading-none text-ink disabled:opacity-30";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled || decrementDisabled}
        aria-label={qty <= 1 ? `Hapus ${label}` : `Kurangi ${label}`}
        className={buttonClass}
      >
        −
      </button>
      <span className="text-ink min-w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled || incrementDisabled}
        aria-label={`Tambah ${label}`}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}
