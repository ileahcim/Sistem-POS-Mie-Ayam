"use client";

import { motion } from "motion/react";
import { PriceText } from "@/components/ui/price-text";
import { ProductImage } from "@/components/ui/product-image";

// Picture on top (4:3), name, then price. The tap itself adds to the cart
// instantly — the scale is only press feedback (CLAUDE.md "Animasi").
export function ProductButton({
  name,
  price,
  imageUrl,
  cartQty,
  onTap,
}: {
  name: string;
  price: number;
  imageUrl: string | null;
  cartQty: number;
  onTap: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className="rounded-card shadow-card border-border bg-surface relative flex flex-col overflow-hidden border text-left"
    >
      <ProductImage name={name} imageUrl={imageUrl} className="aspect-[4/3] w-full" />
      {cartQty > 0 && (
        <span className="bg-primary shadow-card absolute top-2 right-2 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold text-white">
          {cartQty}
        </span>
      )}
      <span className="flex flex-1 flex-col justify-between gap-1 p-2.5">
        <span className="line-clamp-2 text-base leading-tight font-bold text-ink">{name}</span>
        <PriceText amount={price} weight="accent" />
      </span>
    </motion.button>
  );
}
