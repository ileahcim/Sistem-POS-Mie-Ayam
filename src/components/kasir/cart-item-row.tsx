import type { CartItem } from "@/lib/cart/types";
import { cartItemLineTotal } from "@/lib/cart/types";
import { PriceText } from "@/components/ui/price-text";
import { Button } from "@/components/ui/button";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { formatAddonWithQty } from "@/lib/printing/format";

// One line of the Kasir / Pre-order Baru cart. [ − ] qty [ + ] fixes a
// mis-tap without reopening anything (− at 1 takes the line out — it isn't
// saved yet, re-tapping the product brings it back); Edit reopens the add-on
// sheet for a wrong topping or note.
export function CartItemRow({
  item,
  onEdit,
  onChangeQty,
}: {
  item: CartItem;
  onEdit: () => void;
  onChangeQty: (qty: number) => void;
}) {
  const hasDetail = item.addons.length > 0 || !!item.notes;

  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-ink">
          {item.qty}x {item.productName}
        </span>
        <PriceText amount={cartItemLineTotal(item)} weight="secondary" />
      </div>

      {hasDetail && (
        <span className="text-sm text-ink-muted">
          {[item.addons.map(formatAddonWithQty).join(", "), item.notes].filter(Boolean).join(" · ")}
        </span>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <QtyStepper
          qty={item.qty}
          label={item.productName}
          onDecrement={() => onChangeQty(item.qty - 1)}
          onIncrement={() => onChangeQty(item.qty + 1)}
        />
        <Button variant="secondary" size="compact" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </div>
  );
}
