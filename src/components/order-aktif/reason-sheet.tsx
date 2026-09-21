"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { Sheet } from "@/components/ui/sheet";
import { SheetItem } from "@/components/ui/sheet-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export type ReasonActionResult = { ok: true } | { ok: false; error: string };

// Shared "confirm with a reason" bottom sheet — used by Batalkan Order
// (unpaid, any cashier) and Void (paid, OWNER only). One-tap quick reasons
// keep the keyboard optional (CLAUDE.md "Konteks pengguna"); a free-text
// reason is still accepted, and some reason is always required.
export function ReasonSheet({
  open,
  title,
  inputId,
  quickReasons,
  confirmLabel,
  busyLabel,
  notice,
  footnote,
  confirmDisabled = false,
  onSubmit,
  onClose,
  onDone,
}: {
  open: boolean;
  title: string;
  inputId: string;
  quickReasons: string[];
  confirmLabel: string;
  busyLabel: string;
  notice?: ReactNode;
  footnote?: string;
  // Extra condition on top of "a reason was given" — e.g. the DP-cancel sheet
  // won't confirm until the owner has chosen what happens to the DP.
  confirmDisabled?: boolean;
  onSubmit: (reason: string) => Promise<ReasonActionResult>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setReason("");
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit(reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <Sheet
          title={title}
          onClose={close}
          footer={
            <Button variant="danger" size="large" fullWidth disabled={saving || confirmDisabled || !reason.trim()} onClick={handleConfirm}>
              {saving ? busyLabel : confirmLabel}
            </Button>
          }
        >
          {notice && (
            <SheetItem index={0} className="mb-3">
              {notice}
            </SheetItem>
          )}
          <SheetItem index={1}>
            <p className="text-ink mb-2 text-sm font-bold">Alasan</p>
          </SheetItem>
          <div className="mb-3 flex flex-wrap gap-2">
            {quickReasons.map((r, i) => (
              <SheetItem key={r} index={2 + i} interactive className="rounded-pill">
                <button
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-pill h-12 border px-4 text-sm font-semibold",
                    reason === r ? "border-danger bg-danger-soft text-danger" : "border-border text-ink",
                  )}
                >
                  {r}
                </button>
              </SheetItem>
            ))}
          </div>
          <SheetItem index={2 + quickReasons.length}>
            <label htmlFor={inputId} className="text-ink-muted mb-1 block text-sm">
              Atau tulis alasan lain
            </label>
            <input
              id={inputId}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. salah pilih menu"
              className="rounded-input border-border h-12 w-full border px-3 text-base"
            />
          </SheetItem>
          {footnote && <p className="text-ink-faint mt-3 text-xs">{footnote}</p>}
          {error && <p className="text-danger mt-2 text-sm">{error}</p>}
        </Sheet>
      )}
    </AnimatePresence>
  );
}
