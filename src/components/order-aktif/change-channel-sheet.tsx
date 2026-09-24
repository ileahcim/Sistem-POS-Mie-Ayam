"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { changeOrderChannel } from "@/app/order-aktif/actions";
import { CHANNELS, TABLE_LABELS, type ChannelType, type TableLabel } from "@/lib/cart/types";
import { orderTotalFromLines } from "@/lib/orders/order-total";
import { formatRupiah } from "@/lib/printing/format";
import { Sheet } from "@/components/ui/sheet";
import { SheetItem } from "@/components/ui/sheet-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const CHANNEL_LABEL: Record<ChannelType, string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function describe(channel: ChannelType, tableLabel: TableLabel | null) {
  return channel === "DINE_IN" && tableLabel ? `${CHANNEL_LABEL[channel]} · ${tableLabel}` : CHANNEL_LABEL[channel];
}

// Fixing a wrong channel/table tap on an unpaid (OPEN) order — CLAUDE.md
// "Order & status", 24 Sep 2026. Any role (same as Batalkan Order): an input
// mistake, no money has moved. The caller only renders it for OPEN orders;
// changeOrderChannel re-checks the status server-side regardless.
export function ChangeChannelButton({
  orderId,
  orderLabel,
  currentChannel,
  currentTableLabelRaw,
  items,
  onChanged,
}: {
  orderId: string;
  orderLabel: string;
  currentChannel: ChannelType;
  // Order.tableLabel is a free String? in the DB (validated in app code) — narrowed here.
  currentTableLabelRaw: string | null;
  // Only to preview the new total (Ongkir appears/disappears with Antar) —
  // the real total is always recomputed server-side.
  items: readonly { lineTotal: number; qty: number; isDeliveryChargeable: boolean }[];
  onChanged: () => void;
}) {
  const currentTableLabel = TABLE_LABELS.find((t) => t === currentTableLabelRaw) ?? null;
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ChannelType>(currentChannel);
  const [tableLabel, setTableLabel] = useState<TableLabel | null>(currentTableLabel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTable = channel === "DINE_IN" && !tableLabel;
  const unchanged = channel === currentChannel && (channel !== "DINE_IN" || tableLabel === currentTableLabel);
  const canConfirm = !needsTable && !unchanged;

  const currentTotal = orderTotalFromLines(items, currentChannel);
  const newTotal = orderTotalFromLines(items, channel);

  function openSheet() {
    setChannel(currentChannel);
    setTableLabel(currentTableLabel);
    setError(null);
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    setError(null);
    try {
      const result = await changeOrderChannel(orderId, channel, channel === "DINE_IN" ? tableLabel : null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="large" fullWidth onClick={openSheet}>
        Ubah Channel
      </Button>
      <AnimatePresence>
        {open && (
          <Sheet
            title={`Ubah channel ${orderLabel}?`}
            onClose={close}
            footer={
              <Button variant="primary" size="large" fullWidth disabled={saving || !canConfirm} onClick={handleConfirm}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            }
          >
            <SheetItem index={0} className="mb-3">
              <p className="text-ink-muted text-sm">Sekarang: {describe(currentChannel, currentTableLabel)}</p>
            </SheetItem>

            <div className="mb-3 flex gap-2">
              {CHANNELS.map((c, i) => (
                <SheetItem key={c} index={1 + i} interactive className="flex-1">
                  <button
                    type="button"
                    onClick={() => setChannel(c)}
                    aria-pressed={channel === c}
                    className={cn(
                      "rounded-pill h-12 w-full text-sm font-semibold",
                      channel === c ? "bg-primary text-white" : "bg-muted text-ink",
                    )}
                  >
                    {CHANNEL_LABEL[c]}
                  </button>
                </SheetItem>
              ))}
            </div>

            {channel === "DINE_IN" && (
              <>
                <SheetItem index={1 + CHANNELS.length}>
                  <p className="text-ink mb-2 text-sm font-bold">Pilih meja</p>
                </SheetItem>
                <div className="mb-3 flex flex-wrap gap-2">
                  {TABLE_LABELS.map((t, i) => (
                    <SheetItem key={t} index={2 + CHANNELS.length + i} interactive>
                      <button
                        type="button"
                        onClick={() => setTableLabel(t)}
                        aria-pressed={tableLabel === t}
                        className={cn(
                          "rounded-pill h-12 w-16 text-sm font-semibold",
                          tableLabel === t ? "bg-primary text-white" : "bg-muted text-ink",
                        )}
                      >
                        {t}
                      </button>
                    </SheetItem>
                  ))}
                </div>
              </>
            )}

            {newTotal !== currentTotal && (
              <SheetItem index={2 + CHANNELS.length + TABLE_LABELS.length} className="mb-1">
                <p className="text-ink-muted text-sm">
                  {channel === "ANTAR" ? "Ongkir ditambahkan" : "Ongkir dihapus"} — total jadi{" "}
                  <span className="text-ink font-semibold">{formatRupiah(newTotal)}</span> (sebelumnya{" "}
                  {formatRupiah(currentTotal)}).
                </p>
              </SheetItem>
            )}

            {error && <p className="text-danger mt-2 text-sm">{error}</p>}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
