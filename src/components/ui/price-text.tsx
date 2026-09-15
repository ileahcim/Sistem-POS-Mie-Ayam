import { formatRupiah } from "@/lib/printing/format";
import { cn } from "./cn";

export type PriceWeight = "primary" | "secondary" | "total";

// The fix for "nama item dan harga bobotnya sama": a price is either the
// prominent answer for its row (primary — a product's own price, a sheet's
// running total), a quiet supporting number next to something else that's
// the real subject of the row (secondary — an addon option's price, a
// per-line price next to an item name that's already bold), or the one
// number on the whole screen that matters most (total).
const WEIGHT_CLASS: Record<PriceWeight, string> = {
  primary: "text-base font-bold text-ink",
  secondary: "text-sm font-medium text-ink-muted",
  total: "text-lg font-bold text-ink",
};

export function PriceText({
  amount,
  weight = "primary",
  prefix,
  className,
}: {
  amount: number;
  weight?: PriceWeight;
  prefix?: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", WEIGHT_CLASS[weight], className)}>
      {prefix}
      {formatRupiah(amount)}
    </span>
  );
}
