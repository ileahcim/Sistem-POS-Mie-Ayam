"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { subscribeMockPrinter, type MockPrintJob } from "@/lib/printing/printers/mock-printer";
import { ReceiptView } from "./receipt-view";
import { DepositReceiptView } from "./deposit-receipt-view";
import { PackingListView } from "./packing-list-view";

// Always mounted (see root layout) regardless of which driver is active in
// production, so switching PRINTER_DRIVER back to "mock" for debugging
// never requires touching a page's code.
export function MockPrinterOverlay() {
  const [job, setJob] = useState<MockPrintJob | null>(null);

  useEffect(() => subscribeMockPrinter(setJob), []);

  return (
    <AnimatePresence>
      {job && (
        <motion.div
          // overflow-auto, not just -y: the paper inside is a fixed 48-column
          // grid and must never be squeezed into re-wrapping, so a screen too
          // narrow for it scrolls sideways instead.
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setJob(null)}
        >
          <motion.div
            className="rounded-card shadow-sheet bg-surface mt-6 shrink-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-2">
              <span className="text-ink-muted text-sm font-medium">
                {job.kind === "receipt"
                  ? "Preview Struk (MockPrinter)"
                  : job.kind === "deposit-receipt"
                    ? "Preview Bukti Uang Muka (MockPrinter)"
                    : "Preview Daftar Packing (MockPrinter)"}
              </span>
              <button
                type="button"
                onClick={() => setJob(null)}
                className="text-ink-muted hover:bg-muted rounded px-2 py-1 text-sm"
              >
                Tutup
              </button>
            </div>
            <div className="py-4">
              {job.kind === "receipt" ? (
                <ReceiptView data={job.data} />
              ) : job.kind === "deposit-receipt" ? (
                <DepositReceiptView data={job.data} />
              ) : (
                <PackingListView data={job.data} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
