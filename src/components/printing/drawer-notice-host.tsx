"use client";

import { useEffect, useState } from "react";
import { subscribeDrawerNotice, type DrawerNotice } from "@/lib/printing/cash-drawer";

// The small notice after every drawer kick (lib/printing/cash-drawer.ts).
// Mounted once in the root layout — a payment navigates away right after
// the kick, and the notice must still be seen on the next screen. A success
// fades after a moment; a failure stays until closed, because the cashier
// has to know to open the drawer by hand (key, or "Buka Laci" again).
export function DrawerNoticeHost() {
  const [notice, setNotice] = useState<(DrawerNotice & { id: number }) | null>(null);

  useEffect(() => {
    let counter = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeDrawerNotice((next) => {
      counter += 1;
      clearTimeout(timer);
      setNotice({ ...next, id: counter });
      if (next.ok) timer = setTimeout(() => setNotice(null), 2500);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div
        key={notice.id}
        className={
          notice.ok
            ? "bg-primary-strong rounded-card pointer-events-auto max-w-md px-4 py-3 text-base font-semibold text-white shadow-lg"
            : "bg-danger-soft text-danger border-danger rounded-card pointer-events-auto flex max-w-md items-start gap-3 border px-4 py-3 shadow-lg"
        }
      >
        {notice.ok ? (
          notice.simulated ? "Laci dibuka (mode simulasi)" : "Laci dibuka"
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-bold">Laci tidak terbuka</span>
              <span className="text-sm">{notice.error}</span>
              <span className="text-sm">Transaksi tetap tersimpan. Buka laci dengan kunci, atau tekan Buka Laci lagi.</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-danger -mr-1 flex h-12 w-12 shrink-0 items-center justify-center text-2xl"
              aria-label="Tutup pemberitahuan laci"
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
