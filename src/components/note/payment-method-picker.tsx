"use client";

import { cn } from "@/components/ui/cn";
import {
  NOTE_PAYMENT_METHODS,
  NOTE_PAYMENT_METHOD_LABEL,
  NOTE_PAYMENT_METHOD_UNKNOWN_LABEL,
  type NotePaymentMethod,
} from "@/lib/note/payment-method";

// Tap-first Cash/QRIS picker — one definition for all four places a Note
// payment's method can be set (Pembayaran Baru and the edit sheet, in both
// books). Required for a new payment; on an OLD row that was recorded
// before the column existed, leaving it unset stays valid, because guessing
// would invent data the warung never had.
export function PaymentMethodPicker({
  value,
  onChange,
  allowUnknown = false,
}: {
  value: NotePaymentMethod | null;
  onChange: (method: NotePaymentMethod) => void;
  // Only true for an existing row whose method was never recorded — there
  // is deliberately no button that clears a method back to unknown.
  allowUnknown?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ink-muted text-sm font-medium">
        Metode pembayaran{allowUnknown ? " (opsional untuk baris lama)" : ""}
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Metode pembayaran">
        {NOTE_PAYMENT_METHODS.map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => onChange(method)}
            aria-pressed={value === method}
            className={cn(
              "rounded-pill h-12 min-w-24 px-5 text-base font-semibold",
              value === method ? "bg-primary text-white" : "bg-muted text-ink",
            )}
          >
            {NOTE_PAYMENT_METHOD_LABEL[method]}
          </button>
        ))}
      </div>
      {allowUnknown && value === null && (
        <p className="text-ink-faint text-xs">
          Baris lama ini tercatat tanpa metode ({NOTE_PAYMENT_METHOD_UNKNOWN_LABEL}). Biarkan begitu kalau sudah
          tidak ingat — lebih baik kosong daripada ditebak. Kalau dipilih, tidak bisa dikosongkan lagi.
        </p>
      )}
    </div>
  );
}
