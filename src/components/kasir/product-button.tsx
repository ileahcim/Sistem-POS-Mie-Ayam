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
      {/* 4:3, but capped: without a max the picture grows with the card, so
          on a 1366px tablet one photo ate half the screen. The cap keeps at
          least 2 full product rows visible. Phone (390px) lands at ~137px
          wide-ratio height anyway, so the cap never changes it. In a short
          landscape window (phone on its side) the cap tightens further so
          the categories/cart still fit. */}
      <ProductImage
        name={name}
        imageUrl={imageUrl}
        className="aspect-[4/3] max-h-[140px] w-full [@media(max-height:500px)]:max-h-[84px]"
        initialsClassName="text-3xl [@media(max-height:500px)]:text-xl"
      />
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
