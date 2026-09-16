"use client";

import { motion } from "motion/react";
import type { CartItem, ChannelType } from "@/lib/cart/types";
import { computeOrderTotals } from "@/lib/orders/pricing";
import { PriceText } from "@/components/ui/price-text";

// Mobile-only stand-in for the sidebar CartPanel (hidden below `lg`, see
// kasir-screen.tsx) — a compact docked bar showing item count + total.
// Tapping it opens the same cart content as a bottom sheet (CartPanel
// variant="sheet"). Renders nothing when the cart is empty so it never
// covers the product grid before there's anything to review.
export function CartBar({
  items,
  channel,
  onTap,
}: {
  items: CartItem[];
  channel: ChannelType | null;
  onTap: () => void;
}) {
  if (items.length === 0) return null;

  const totals = computeOrderTotals(items, channel);
  const qty = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="border-border bg-surface shadow-panel fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-between border-t px-4 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <span className="flex items-center gap-2.5">
        <span className="bg-primary flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold text-white">
          {qty}
        </span>
        <span className="text-base font-bold text-ink">Lihat Keranjang</span>
      </span>
      <PriceText amount={totals.total} weight="total" />
    </motion.button>
  );
}
