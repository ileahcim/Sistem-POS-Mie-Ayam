"use client";

import { useState } from "react";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";
import { formatRupiah } from "@/lib/printing/format";
import { DEPOSIT_METHODS, DEPOSIT_METHOD_LABEL, type DepositMethod } from "@/lib/deposits/settle";

export type DepositDraft = { amount: number; method: DepositMethod };

// `amount` 0 means "no DP". Cash is only the starting method when a shift is
// open — a cash DP needs one (it goes into the drawer), so with no shift the
// picker starts on QRIS instead of on a choice the server would refuse.
export const initialDepositDraft = (cashAvailable: boolean): DepositDraft => ({
  amount: 0,
  method: cashAvailable ? "CASH" : "QRIS",
});

const PRESETS = [50_000, 100_000, 200_000, 500_000];

function Pill({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-pill h-12 px-4 text-base font-semibold disabled:opacity-40",
        selected ? "bg-primary text-white" : "bg-muted text-ink",
      )}
    >
      {children}
    </button>
  );
}

// Tap-first DP entry (staff stand while using this, CLAUDE.md "Konteks
// pengguna"): preset amounts and Cash/QRIS pills, with a typed amount only
// behind "Lain-lain". The server re-validates everything — the hints here are
// just so the cashier sees "melebihi total" before pressing save.
export function DepositPicker({
  total,
  alreadyHeld = 0,
  value,
  onChange,
  cashAvailable,
  allowNone,
}: {
  total: number;
  alreadyHeld?: number;
  value: DepositDraft;
  onChange: (next: DepositDraft) => void;
  cashAvailable: boolean;
  // Creating a pre-order: DP is optional, so "Tanpa DP" is a real choice.
  allowNone: boolean;
}) {
  const room = Math.max(0, total - alreadyHeld);
  const [custom, setCustom] = useState(false);
  const presets = PRESETS.filter((p) => p <= room);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <Pill
            selected={value.amount === 0 && !custom}
            onClick={() => {
              setCustom(false);
              onChange({ ...value, amount: 0 });
            }}
          >
            Tanpa DP
          </Pill>
        )}
        {presets.map((preset) => (
          <Pill
            key={preset}
            selected={!custom && value.amount === preset}
            onClick={() => {
              setCustom(false);
              onChange({ ...value, amount: preset });
            }}
          >
            {preset / 1000} rb
          </Pill>
        ))}
        <Pill
          selected={custom}
          onClick={() => {
            setCustom(true);
            onChange({ ...value, amount: 0 });
          }}
        >
          Lain-lain
        </Pill>
      </div>

      {custom && (
        <RupiahInput
          value={value.amount || ""}
          onChange={(amount) => onChange({ ...value, amount })}
          placeholder="Nominal DP"
          className="h-12 text-base"
        />
      )}

      {value.amount > 0 && (
        <div className="flex gap-2">
          {DEPOSIT_METHODS.map((method) => (
            <div key={method} className="flex-1">
              <button
                type="button"
                disabled={method === "CASH" && !cashAvailable}
                onClick={() => onChange({ ...value, method })}
                aria-pressed={value.method === method}
                className={cn(
                  "rounded-pill h-12 w-full text-base font-semibold disabled:opacity-40",
                  value.method === method ? "bg-primary text-white" : "bg-muted text-ink",
                )}
              >
                {DEPOSIT_METHOD_LABEL[method]}
              </button>
            </div>
          ))}
        </div>
      )}
      {value.amount > 0 && !cashAvailable && (
        <p className="text-ink-faint text-xs">DP tunai butuh shift terbuka (uangnya masuk laci). QRIS bisa kapan saja.</p>
      )}

      {value.amount > 0 && value.amount <= room && (
        <p className="text-ink-muted text-sm">
          DP {formatRupiah(value.amount)} · Sisa {formatRupiah(room - value.amount)}
        </p>
      )}
      {value.amount > room && (
        <p className="text-danger text-sm">DP melebihi total. Maksimal {formatRupiah(room)}.</p>
      )}
    </div>
  );
}
