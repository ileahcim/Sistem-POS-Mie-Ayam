"use client";

import { useState, type ReactNode } from "react";
import type { DepositReceiptData, PrinterDriver } from "@/lib/printing/types";
import { printDepositReceiptSafely } from "@/lib/printing/print-deposit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// What happens to the paper right after a DP is saved — the same contract as
// the struk on the payment screen: the DP is already fully recorded, this only
// decides about the PRINT. autoPrintReceipt on → print at once (and only speak
// up if it failed); off → ask "Cetak bukti?". A failure never disappears
// silently: the reason stays on screen with Coba Lagi / Lewati.
//
// Returns handleRecorded(receipt) for the parent to call the moment the server
// confirms the DP, and `prompt` to render (null when there is nothing to ask).
export function useDepositReceiptPrompt({
  autoPrint,
  printerDriver,
  onFinished,
}: {
  autoPrint: boolean;
  printerDriver: PrinterDriver;
  onFinished: () => void;
}): { handleRecorded: (receipt: DepositReceiptData) => Promise<void>; prompt: ReactNode } {
  const [pending, setPending] = useState<DepositReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  async function handleRecorded(receipt: DepositReceiptData) {
    if (autoPrint) {
      const failure = await printDepositReceiptSafely(printerDriver, receipt);
      if (failure === null) {
        onFinished();
        return;
      }
      setError(failure);
    }
    setPending(receipt);
  }

  async function handleChoice(shouldPrint: boolean) {
    if (shouldPrint && pending) {
      setPrinting(true);
      setError(null);
      const failure = await printDepositReceiptSafely(printerDriver, pending);
      setPrinting(false);
      if (failure !== null) {
        setError(failure);
        return; // stay: show why, let the cashier retry or skip
      }
    }
    setPending(null);
    setError(null);
    onFinished();
  }

  const prompt = pending ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-card bg-surface shadow-sheet flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <Badge variant="success">DP tercatat</Badge>
        {error ? (
          <div className="flex flex-col gap-1">
            <p className="text-danger text-lg font-bold">Bukti belum tercetak</p>
            <p className="text-ink-muted text-sm">
              DP sudah tersimpan. Pastikan printer menyala dan Bluetooth tablet aktif, lalu coba lagi.
            </p>
            <p className="text-ink-faint text-xs">Penyebab: {error}</p>
          </div>
        ) : (
          <div>
            <p className="text-ink text-lg font-bold">Cetak bukti uang muka?</p>
            <p className="text-ink-muted mt-1 text-sm">DP sudah tersimpan — ini cuma soal cetak kertasnya.</p>
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

  return { handleRecorded, prompt };
}
