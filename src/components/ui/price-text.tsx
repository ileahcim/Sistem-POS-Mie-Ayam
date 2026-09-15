import { formatRupiah } from "@/lib/printing/format";
import { cn } from "./cn";

export type PriceWeight = "primary" | "secondary" | "total" | "accent";

// The fix for "nama item dan harga bobotnya sama": a price is either the
// prominent answer for its row (primary — a product's own price, a sheet's
// running total), a quiet supporting number next to something else that's
// the real subject of the row (secondary — an addon option's price, a
// per-line price next to an item name that's already bold), the one number
// on the whole screen that matters most (total), or a price that needs to
// read as an appetizing "buy me" tag rather than either of those — smaller
// than the item name above it (still secondary in the size hierarchy) but
// colored so it doesn't fade into gray (accent — product grid buttons).
const WEIGHT_CLASS: Record<PriceWeight, string> = {
  primary: "text-base font-bold text-ink",
  secondary: "text-sm font-medium text-ink-muted",
  total: "text-lg font-bold text-ink",
  accent: "text-sm font-bold text-primary-strong",
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
