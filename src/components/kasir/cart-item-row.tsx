import type { CartItem } from "@/lib/cart/types";
import { cartItemLineTotal } from "@/lib/cart/types";
import { PriceText } from "@/components/ui/price-text";
import { formatAddonWithQty } from "@/lib/printing/format";

export function CartItemRow({
  item,
  onEdit,
  onRemove,
}: {
  item: CartItem;
  onEdit: () => void;
  onRemove: () => void;
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

      <div className="mt-0.5 flex justify-end gap-4 text-sm font-medium">
        <button type="button" onClick={onEdit} className="text-primary-strong">
          Edit
        </button>
        <button type="button" onClick={onRemove} className="text-danger">
          Hapus
        </button>
      </div>
    </div>
  );
}
