"use client";

import { useState } from "react";
import type { PrinterDriver } from "@/lib/printing/types";
import { getPrinter } from "@/lib/printing/get-printer";
import {
  buildTestPackingList,
  buildTestReceipt,
  printPackingListTest,
  printTest,
} from "@/lib/printing/test-print";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const DRIVER_OPTIONS: { value: PrinterDriver; label: string }[] = [
  { value: "mock", label: "Mock (preview)" },
  { value: "webbluetooth", label: "Web Bluetooth" },
  { value: "rawbt", label: "RawBT" },
];

// Dev console for exercising the printing module without a real order flow.
// Left always reachable after launch too: "Cetak ke printer" runs the exact
// driver used in production (the one set in /admin/settings is a drop-down
// away here), with mock left for pure on-screen preview — see MockPrinter's
// docblock and escpos.ts.
export default function PrintPreviewPage() {
  const mockPrinter = getPrinter("mock");
  const [driver, setDriver] = useState<PrinterDriver>("webbluetooth");
  const [printing, setPrinting] = useState<"receipt" | "packing" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function printToDevice(kind: "receipt" | "packing") {
    setPrinting(kind);
    setStatus(null);
    try {
      const result = kind === "receipt" ? await printTest(driver) : await printPackingListTest(driver);
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      if (driver === "mock") setStatus("Preview mock muncul di overlay di bawah.");
      else if (driver === "rawbt") setStatus("Perintah cetak dikirim ke RawBT.");
      else setStatus("Perintah cetak dikirim ke printer Bluetooth.");
    } finally {
      setPrinting(null);
    }
  }

  return (
    <div className="bg-canvas mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-bold text-ink">Print Preview (dev)</h1>
      <p className="text-ink-muted text-sm">
        Preview layar di bawah selalu digerakkan <code>MockPrinter</code> (getPrinter(&quot;mock&quot;)).
        Tiga tombol terakhir mengirim byte ESC/POS yang persis sama (lihat <code>escpos.ts</code>) ke driver
        yang dipilih — sama seperti yang dipakai pembayaran/daftar packing di aplikasi.
      </p>

      <div role="group" aria-label="Driver cetak" className="rounded-pill bg-muted flex h-11 items-center p-0.5 text-sm font-semibold">
        {DRIVER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDriver(option.value)}
            aria-pressed={driver === option.value}
            className={cn(
              "rounded-pill h-10 flex-1 px-2",
              driver === option.value ? "bg-surface text-ink shadow-card" : "text-ink-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Button variant="primary" size="large" onClick={() => mockPrinter.printReceipt(buildTestReceipt())}>
        Preview Struk Pembayaran
      </Button>
      <Button variant="ghost" size="large" onClick={() => mockPrinter.printPackingList(buildTestPackingList())}>
        Preview Daftar Packing (Antar)
      </Button>

      <Button
        variant="secondary"
        size="large"
        disabled={printing != null}
        onClick={() => printToDevice("receipt")}
      >
        {printing === "receipt" ? "Mencetak..." : `Cetak Struk ke ${DRIVER_OPTIONS.find((d) => d.value === driver)?.label}`}
      </Button>
      <Button
        variant="secondary"
        size="large"
        disabled={printing != null}
        onClick={() => printToDevice("packing")}
      >
        {printing === "packing" ? "Mencetak..." : "Cetak Daftar Packing"}
      </Button>

      {status && <p className={cn("text-sm", status.startsWith("Perintah") ? "text-primary-strong" : "text-danger")}>{status}</p>}
    </div>
  );
}