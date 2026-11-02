"use client";

import { motion } from "motion/react";
import { PriceText } from "@/components/ui/price-text";
import { ProductImage } from "@/components/ui/product-image";
import { LOW_STOCK_THRESHOLD, remainingStock } from "@/lib/stock/types";

// Picture on top (4:3), name, then price. The tap itself adds to the cart
// instantly — the scale is only press feedback (CLAUDE.md "Animasi").
//
// Es krim (stock != null, docs/spec-es-krim.md): a small muted "stok N" line,
// a small "sisa N" badge at ≤5, and at 0 the card goes grey and can't be
// tapped. N already subtracts what is in the cart on this screen.
export function ProductButton({
  name,
  price,
  imageUrl,
  cartQty,
  stock = null,
  onTap,
}: {
  name: string;
  price: number;
  imageUrl: string | null;
  cartQty: number;
  stock?: number | null;
  onTap: () => void;
}) {
  const left = remainingStock(stock, cartQty);
  const soldOut = left === 0;
  return (
    <motion.button
      type="button"
      onClick={onTap}
      disabled={soldOut}
      aria-label={soldOut ? `${name} — stok habis` : undefined}
      whileTap={soldOut ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={
        "rounded-card shadow-card border-border relative flex flex-col overflow-hidden border text-left " +
        (soldOut ? "bg-muted cursor-not-allowed opacity-60 grayscale" : "bg-surface")
      }
    >
      {/* The picture box is INSET 6px, not flush with the card edge: flush, its
          frame would land on the card's own border and read as one thick
          doubled line. Its corner radius is concentric with the card's (card
          radius − 1px border − 6px inset), so the two outlines run parallel.
          Same inset for placeholder and photo, so names line up across a row.

          4:3, but capped: without a max the picture grows with the card, so
          on a 1366px tablet one photo ate half the screen. The cap keeps at
          least 2 full product rows visible. Phone (390px) lands at ~127px
          wide-ratio height anyway, so the cap never changes it. In a short
          landscape window (phone on its side) the cap tightens further so
          the categories/cart still fit. */}
      <div className="p-1.5 pb-0">
        <ProductImage
          name={name}
          imageUrl={imageUrl}
          className="aspect-[4/3] max-h-[140px] w-full rounded-[calc(var(--radius-card)-7px)] [@media(max-height:500px)]:max-h-[84px]"
          initialsClassName="text-3xl [@media(max-height:500px)]:text-xl"
        />
      </div>
      {cartQty > 0 && (
        <span className="bg-primary shadow-card absolute top-3.5 right-3.5 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold text-white">
          {cartQty}
        </span>
      )}
      <span className="flex flex-1 flex-col justify-between gap-1 p-2.5">
        <span className="line-clamp-2 text-base leading-tight font-bold text-ink">{name}</span>
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <PriceText amount={price} weight="accent" />
          {left != null &&
            (soldOut ? (
              <span className="text-ink-muted text-xs font-semibold">Stok habis</span>
            ) : left <= LOW_STOCK_THRESHOLD ? (
              <span className="rounded-pill bg-warning-soft text-warning px-2 py-0.5 text-xs font-semibold">sisa {left}</span>
            ) : (
              <span className="text-ink-faint text-xs">stok {left}</span>
            ))}
        </span>
      </span>
    </motion.button>
  );
}
