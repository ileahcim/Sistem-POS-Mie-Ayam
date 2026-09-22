"use client";

import { useState, type ReactNode } from "react";
import type { KitchenTicketData, PrinterDriver } from "@/lib/printing/types";
import { printKitchenTicketSafely } from "@/lib/printing/print-kitchen-ticket";
import { Button } from "@/components/ui/button";

// The kitchen ticket prompt shared by "Simpan Pesanan" (kasir-screen.tsx) and
// "+ Tambah Item" (add-items-panel.tsx). Unlike the struk/DP-proof prompts,
// this one is NEVER automatic — owner's decision, 22 Sep 2026 revision: a
// busy shift and a quiet one decide differently, so the cashier is always
// asked, even with "Kertas dapur" on. The caller only calls `offer(ticket)`
// when the setting is on AND buildKitchenTicketData returned non-null
// (something on the order actually needs the kitchen) — otherwise it skips
// this hook entirely and the flow stays exactly as it was before this
// feature existed.
export function useKitchenTicketPrompt({
  printerDriver,
}: {
  printerDriver: PrinterDriver;
}): { offer: (ticket: KitchenTicketData) => void; prompt: ReactNode } {
  const [pending, setPending] = useState<KitchenTicketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  function offer(ticket: KitchenTicketData) {
    setError(null);
    setPending(ticket);
  }

  async function handleChoice(shouldPrint: boolean) {
    if (shouldPrint) {
      setPrinting(true);
      setError(null);
      const failure = pending ? await printKitchenTicketSafely(printerDriver, pending) : null;
      setPrinting(false);
      if (failure !== null) {
        setError(failure);
        return; // stay: show why, let the cashier retry or skip
      }
    }
    setPending(null);
    setError(null);
  }

  const prompt = pending ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-card bg-surface shadow-sheet flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        {error ? (
          <div className="flex flex-col gap-1">
            <p className="text-danger text-lg font-bold">Tiket dapur belum tercetak</p>
            <p className="text-ink-muted text-sm">
              Pesanan sudah tersimpan. Pastikan printer menyala dan Bluetooth tablet aktif, lalu coba lagi.
            </p>
            <p className="text-ink-faint text-xs">Penyebab: {error}</p>
          </div>
        ) : (
          <div>
            <p className="text-ink text-lg font-bold">Cetak kertas dapur?</p>
            <p className="text-ink-muted mt-1 text-sm">Pesanan sudah tersimpan — ini cuma soal cetak kertasnya.</p>
          </div>
        )}
        <div className="flex w-full gap-2">
          <Button variant="secondary" size="large" fullWidth disabled={printing} onClick={() => handleChoice(false)}>
            {error ? "Lewati" : "Tidak"}
          </Button>
          <Button variant="primary" size="large" fullWidth disabled={printing} onClick={() => handleChoice(true)}>
            {printing ? "Mencetak..." : error ? "Coba Lagi" : "Ya, Cetak"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { offer, prompt };
}
