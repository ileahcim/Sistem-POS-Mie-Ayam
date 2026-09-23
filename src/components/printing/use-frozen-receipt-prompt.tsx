"use client";

import { useState, type ReactNode } from "react";
import type { FrozenReceiptData, PrinterDriver } from "@/lib/printing/types";
import { printFrozenReceiptSafely } from "@/lib/printing/print-frozen-receipt";
import { isWebBluetoothSupported } from "@/lib/printing/printers/web-bluetooth-printer";
import { Button } from "@/components/ui/button";

// Mirrors use-kitchen-ticket-prompt.tsx's {offer, prompt} shape, used after
// recording a Frozen pickup or payment. Gated for the printer's real
// constraint (owner's brief, 22 Sep 2026): the ECO80D pairs to the Android
// tablet over Web Bluetooth, which Safari on iPhone does not support at all
// — a "Ya, Cetak" button that's guaranteed to fail is worse than an honest
// explanation, so this shows one instead whenever that's the situation.
export function useFrozenReceiptPrompt({
  printerDriver,
}: {
  printerDriver: PrinterDriver;
}): { offer: (data: FrozenReceiptData, onDismiss?: () => void) => void; prompt: ReactNode } {
  const [pending, setPending] = useState<FrozenReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  // Runs once the prompt is fully dismissed (Ya/Tidak decided, or the
  // "Mengerti" acknowledgement) — the pickup/payment forms use this to defer
  // navigating away until the owner has actually seen/dismissed the prompt,
  // since that navigation would otherwise unmount the prompt itself.
  const [onDismiss, setOnDismiss] = useState<(() => void) | null>(null);

  const printingUnavailable = printerDriver === "webbluetooth" && !isWebBluetoothSupported();

  function offer(data: FrozenReceiptData, dismissCallback?: () => void) {
    setError(null);
    setPending(data);
    setOnDismiss(() => dismissCallback ?? null);
  }

  function dismiss() {
    setPending(null);
    setError(null);
    onDismiss?.();
  }

  async function handleChoice(shouldPrint: boolean) {
    if (shouldPrint) {
      setPrinting(true);
      setError(null);
      const failure = pending ? await printFrozenReceiptSafely(printerDriver, pending) : null;
      setPrinting(false);
      if (failure !== null) {
        setError(failure);
        return; // stay: show why, let the owner retry or skip
      }
    }
    dismiss();
  }

  const prompt = pending ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-card bg-surface shadow-sheet flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        {printingUnavailable ? (
          <div className="flex flex-col gap-1">
            <p className="text-ink text-lg font-bold">Tidak bisa cetak dari perangkat ini</p>
            <p className="text-ink-muted text-sm">
              Printer terhubung Bluetooth ke tablet kasir — cetak bukti Frozen cuma bisa dilakukan dari tablet itu.
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col gap-1">
            <p className="text-danger text-lg font-bold">Bukti belum tercetak</p>
            <p className="text-ink-muted text-sm">
              Transaksi sudah tersimpan. Pastikan printer menyala dan Bluetooth tablet aktif, lalu coba lagi.
            </p>
            <p className="text-ink-faint text-xs">Penyebab: {error}</p>
          </div>
        ) : (
          <div>
            <p className="text-ink text-lg font-bold">Cetak bukti?</p>
            <p className="text-ink-muted mt-1 text-sm">Transaksi sudah tersimpan — ini cuma soal cetak buktinya.</p>
          </div>
        )}
        <div className="flex w-full gap-2">
          {printingUnavailable ? (
            <Button variant="primary" size="large" fullWidth onClick={dismiss}>
              Mengerti
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="large" fullWidth disabled={printing} onClick={() => handleChoice(false)}>
                {error ? "Lewati" : "Tidak"}
              </Button>
              <Button variant="primary" size="large" fullWidth disabled={printing} onClick={() => handleChoice(true)}>
                {printing ? "Mencetak..." : error ? "Coba Lagi" : "Ya, Cetak"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return { offer, prompt };
}
