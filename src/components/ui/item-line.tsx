import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/printing/format";
import { PriceText } from "./price-text";
import { cn } from "./cn";

// One item of any order/cart list, with its harga satuan (2 Nov 2026, owner's
// request — one portion, add-ons included) next to the line total:
//
//   tablet (md and up), three columns:
//     5x Mie Ayam Bakso Urat        Rp18.000      Rp90.000
//        Bakso
//   phone, harga satuan under the name, small and grey:
//     5x Mie Ayam Bakso Urat                      Rp90.000
//        @Rp18.000 · Bakso
//
// The two price columns have a fixed minimum width so they line up down a
// list; the name column takes what's left and wraps per word. Server-
// renderable (no "use client"), so any list can use it.
export function ItemLine({
  qty,
  name,
  unitPrice,
  lineTotal,
  detail,
  badge,
  size = "default",
}: {
  qty: number;
  name: string;
  unitPrice: number;
  lineTotal: number;
  // Add-ons and note, already joined ("Bakso, Ceker · gak pake sawi").
  detail?: string | null;
  // e.g. the "Custom" badge after the name.
  badge?: ReactNode;
  // "small" for the compact lists (Order Aktif row, + Tambah Item pending).
  size?: "default" | "small";
}) {
  const nameClass = size === "small" ? "text-sm font-medium text-ink" : "text-base font-semibold text-ink";
  const subClass = size === "small" ? "text-xs" : "text-sm";
  const priceClass = cn("shrink-0 text-right", size === "small" && "text-xs");
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className={nameClass}>
          {qty}x {name}
          {badge}
        </div>
        <div className={cn("text-ink-muted", subClass, !detail && "md:hidden")}>
          <span className="tabular-nums md:hidden">@{formatRupiah(unitPrice)}</span>
          {detail && (
            <>
              <span className="md:hidden"> · </span>
              {detail}
            </>
          )}
        </div>
      </div>
      <PriceText
        amount={unitPrice}
        weight="secondary"
        className={cn(priceClass, "hidden min-w-[4.5rem] md:block")}
      />
      <PriceText amount={lineTotal} weight="secondary" className={cn(priceClass, "min-w-[4.5rem]")} />
    </div>
  );
}
