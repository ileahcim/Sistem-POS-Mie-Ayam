"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { OrderDetail, OrderDetailItem } from "@/lib/orders/get-order-detail";
import { splitAndPay } from "@/app/order-aktif/actions";
import { Sheet } from "@/components/ui/sheet";
import { HoverTint, ITEM_TAP, sheetItemMotion, useSheetMotionPrefs } from "@/components/ui/sheet-motion";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { cn } from "@/components/ui/cn";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";

type Side = "stay" | "split";

// lineTotal was always unitTotal * qty (see buildOrderItemsCreateData), so
// this division is exact.
function unitTotalOf(item: OrderDetailItem): number {
  return item.lineTotal / item.qty;
}

function detailLine(item: OrderDetailItem): string {
  return [groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", "), item.notes].filter(Boolean).join(" · ");
}

const MOVE = { duration: 0.18, ease: "easeOut" } as const;

// One tappable cart-style card. Tapping moves exactly one portion to the
// other panel; the card stays put with its number changed while qty > 0,
// and leaves (fade + slight scale) when it hits 0. Cards present when the
// sheet opens stagger in with the shared sheet pattern (`introIndex`);
// cards that appear later because of a tap use the short move animation.
function SplitCard({
  item,
  qty,
  side,
  introIndex,
  onTap,
}: {
  item: OrderDetailItem;
  qty: number;
  side: Side;
  introIndex: number | null;
  onTap: () => void;
}) {
  const detail = detailLine(item);
  const prefs = useSheetMotionPrefs();
  const intro = introIndex != null ? sheetItemMotion(prefs, introIndex) : null;
  return (
    <motion.button
      type="button"
      layout
      initial={intro ? intro.initial : { opacity: 0, scale: 0.96, x: side === "split" ? -16 : 16 }}
      animate={intro ? intro.animate : { opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: MOVE }}
      whileHover="hover"
      whileTap={prefs.reduced ? undefined : ITEM_TAP}
      transition={intro ? intro.transition : MOVE}
      onClick={onTap}
      aria-label={
        side === "stay"
          ? `Pindahkan 1 ${item.productName} ke pembayaran terpisah`
          : `Kembalikan 1 ${item.productName} ke order ini`
      }
      className={cn(
        "rounded-card relative flex min-h-14 w-full flex-col gap-0.5 overflow-hidden border p-3 text-left",
        side === "split" ? "border-primary bg-primary-soft" : "border-border bg-surface",
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="text-base font-semibold text-ink">
          <motion.span
            key={qty}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.16 }}
            className="inline-block tabular-nums"
          >
            {qty}x
          </motion.span>{" "}
          {item.productName}
        </span>
        <PriceText amount={unitTotalOf(item) * qty} weight="secondary" />
      </span>
      {detail && <span className="text-ink-muted text-sm">{detail}</span>}
      <HoverTint />
    </motion.button>
  );
}

function Panel({
  title,
  side,
  entries,
  emptyText,
  onTap,
}: {
  title: string;
  side: Side;
  entries: { item: OrderDetailItem; qty: number }[];
  emptyText: string;
  onTap: (itemId: string) => void;
}) {
  // Only the cards rendered on the sheet's first frame get the staggered
  // entrance; from the first tap on, every card change is a move.
  const [introIds, setIntroIds] = useState(() => entries.map((e) => e.item.id));
  const subtotal = entries.reduce((sum, e) => sum + unitTotalOf(e.item) * e.qty, 0);
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-card flex min-h-40 flex-col border",
        side === "split" ? "border-primary bg-canvas" : "border-border bg-canvas",
      )}
    >
      <h3
        className={cn(
          "px-3 pt-3 pb-2 text-sm font-bold",
          side === "split" ? "text-primary-strong" : "text-ink",
        )}
      >
        {title}
      </h3>
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
        <AnimatePresence mode="popLayout">
          {entries.map((e) => {
            const introIndex = introIds.indexOf(e.item.id);
            return (
              <SplitCard
                key={e.item.id}
                item={e.item}
                qty={e.qty}
                side={side}
                introIndex={introIndex >= 0 ? introIndex : null}
                onTap={() => {
                  setIntroIds([]);
                  onTap(e.item.id);
                }}
              />
            );
          })}
        </AnimatePresence>
        {entries.length === 0 && (
          <p className="text-ink-faint flex flex-1 items-center justify-center py-6 text-center text-sm">
            {emptyText}
          </p>
        )}
      </div>
      <div className="border-border flex items-center justify-between border-t px-3 py-2">
        <span className="text-ink text-sm font-bold">Subtotal</span>
        <PriceText amount={subtotal} weight="total" />
      </div>
    </section>
  );
}

// "Pisahkan & Bayar" — CLAUDE.md "Split payment": deliberately a secondary,
// two-step affordance (a plain ghost button that opens a sheet, never in
// the primary payment button row) so it never adds friction to the normal
// single-order "tap Bayar" path. Inside, two panels side by side (stacked
// on a narrow screen): what stays on this order, and what gets split off
// and paid now — tap a card to move one portion across. Renders nothing
// when there's nothing to split (not OPEN, or only 1 unit total).
export function SplitAndPayButton({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // itemId -> portions moved to the "split" panel
  const [moved, setMoved] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);
  if (order.status !== "OPEN" || totalQty <= 1) return null;

  const movedTotal = Object.values(moved).reduce((a, b) => a + b, 0);
  const nothingLeft = movedTotal >= totalQty;
  const canConfirm = movedTotal > 0 && !nothingLeft;

  const stayEntries = order.items
    .map((item) => ({ item, qty: item.qty - (moved[item.id] ?? 0) }))
    .filter((e) => e.qty > 0);
  const splitEntries = order.items
    .map((item) => ({ item, qty: moved[item.id] ?? 0 }))
    .filter((e) => e.qty > 0);

  function shift(itemId: string, delta: 1 | -1) {
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return;
    setMoved((prev) => {
      const next = Math.min(item.qty, Math.max(0, (prev[itemId] ?? 0) + delta));
      return { ...prev, [itemId]: next };
    });
    setError(null);
  }

  function closeAndReset() {
    setOpen(false);
    setMoved({});
    setError(null);
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const selections = Object.entries(moved)
        .filter(([, qty]) => qty > 0)
        .map(([orderItemId, qty]) => ({ orderItemId, qty }));
      const result = await splitAndPay(order.id, selections);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/pembayaran/${result.newOrderId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Pisahkan & Bayar
      </Button>
      <AnimatePresence>
        {open && (
          <Sheet
            title="Pisahkan & Bayar"
            onClose={closeAndReset}
            footer={
              <div className="flex flex-col gap-2">
                {nothingLeft && (
                  <p className="text-warning text-center text-sm font-medium">
                    Sisakan minimal 1 item di order ini. Kalau semua dibayar sekaligus, pakai Lanjut ke Pembayaran.
                  </p>
                )}
                {error && <p className="text-danger text-center text-sm">{error}</p>}
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  disabled={!canConfirm || saving}
                  onClick={handleConfirm}
                >
                  {saving ? "Memproses..." : "Pisahkan & Lanjut Bayar"}
                </Button>
              </div>
            }
          >
            <MotionConfig reducedMotion="user">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Panel
                  title="Tetap di order ini"
                  side="stay"
                  entries={stayEntries}
                  emptyText="Semua item sudah dipindah"
                  onTap={(id) => shift(id, 1)}
                />
                <Panel
                  title="Dipisah & dibayar sekarang"
                  side="split"
                  entries={splitEntries}
                  emptyText="Belum ada item dipilih"
                  onTap={(id) => shift(id, -1)}
                />
              </div>
            </MotionConfig>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
