"use client";

import { useState } from "react";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { updateAutoPrintReceipt } from "@/app/admin/settings/actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { cn } from "@/components/ui/cn";

// Only the auto-print toggle lives here for now — the rest of `Setting`
// (store info, prep-time minutes) has no admin UI yet either; this page is
// a starting point for that, not the full editor, since only the print
// toggle was actually asked for.
export function SettingsScreen({
  settings,
  orderAktifIndicator,
}: {
  settings: StoreSettings;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const [autoPrint, setAutoPrint] = useState(settings.autoPrintReceipt);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function handleChange(next: boolean) {
    if (next === autoPrint) return;
    setAutoPrint(next);
    setSaving(true);
    setSavedFlash(false);
    try {
      const result = await updateAutoPrintReceipt(next);
      if (!result.ok) {
        setAutoPrint(!next); // roll back on failure
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Pengaturan</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <LinkButton href="/dashboard" variant="secondary">Ke Dashboard</LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <Card padded className="flex flex-col gap-2">
            <div>
              <p className="text-ink text-base font-semibold">Cetak struk otomatis</p>
              <p className="text-ink-muted text-sm">
                Nyala: struk langsung tercetak setelah Bayar. Mati: kasir ditanya &ldquo;Cetak struk?&rdquo;
                dulu — transaksi tetap tersimpan penuh apa pun pilihannya.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-pill bg-muted flex h-11 items-center p-0.5 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => handleChange(true)}
                  disabled={saving}
                  className={cn(
                    "rounded-pill h-10 px-4",
                    autoPrint ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                  )}
                >
                  Nyala
                </button>
                <button
                  type="button"
                  onClick={() => handleChange(false)}
                  disabled={saving}
                  className={cn(
                    "rounded-pill h-10 px-4",
                    !autoPrint ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                  )}
                >
                  Mati
                </button>
              </div>
              {savedFlash && <p className="text-primary-strong text-sm font-medium">Tersimpan ✓</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
