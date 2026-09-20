"use client";

import { useState } from "react";
import Link from "next/link";
import type { PreOrderReminder } from "@/lib/orders/get-preorders";

// Red bar on the Kasir screen for pre-orders coming due inside the window
// the owner set (Setting.preorderReminderMinutes, default 2 jam). Before
// this, a pre-order taken days earlier simply sat in its own tab and nothing
// on the register ever mentioned it again.
//
// Dismissal is deliberately in-memory only: closing it clears the bar for
// the rest of this screen session, a refresh brings it straight back, and a
// DIFFERENT pre-order entering the window re-opens it even without a
// refresh — because what's remembered is WHICH orders were dismissed, not
// "the bar is off". A tablet left on all evening must not be able to go
// permanently quiet about a delivery.
//
// Every time string is formatted on the server in Asia/Jakarta and only
// printed here (CLAUDE.md "Zona waktu") — the tablet's own clock never gets
// to decide what "jam 18.30" means.
const MAX_TIMES_SHOWN = 4;

export function PreorderReminderBanner({ reminders }: { reminders: PreOrderReminder[] }) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const pending = reminders.filter((r) => !dismissedIds.includes(r.id));
  if (pending.length === 0) return null;

  const shown = pending.slice(0, MAX_TIMES_SHOWN);
  const times = shown
    .map((r) => (r.isToday ? `jam ${r.timeLabel}` : `${r.dateLabel} jam ${r.timeLabel}`))
    .join(", ");
  const more = pending.length - shown.length;

  const message =
    pending.length === 1
      ? `1 pesanan terjadwal dikirim ${times} — siapkan sekarang`
      : `${pending.length} pesanan terjadwal segera dikirim: ${times}${more > 0 ? `, +${more} lagi` : ""}`;

  return (
    <div className="bg-danger flex items-center gap-1 pl-3 text-white">
      <Link href="/pesanan-terjadwal" className="flex-1 py-2 text-center text-sm font-bold">
        {message}
      </Link>
      <button
        type="button"
        onClick={() => setDismissedIds(reminders.map((r) => r.id))}
        aria-label="Tutup pengingat pesanan terjadwal"
        className="flex h-12 w-12 shrink-0 items-center justify-center text-xl leading-none"
      >
        ×
      </button>
    </div>
  );
}
