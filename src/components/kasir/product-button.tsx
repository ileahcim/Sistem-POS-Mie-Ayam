"use client";

import { motion } from "motion/react";
import { PriceText } from "@/components/ui/price-text";

export function ProductButton({
  name,
  price,
  cartQty,
  onTap,
}: {
  name: string;
  price: number;
  cartQty: number;
  onTap: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className="rounded-card shadow-card border-border bg-surface relative flex min-h-28 flex-col items-start justify-between border p-4 text-left"
    >
      {cartQty > 0 && (
        <span className="bg-primary absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white">
          {cartQty}
        </span>
      )}
      <span className="text-lg font-bold leading-tight text-ink">{name}</span>
      <PriceText amount={price} weight="secondary" className="text-base" />
    </motion.button>
  );
}
