"use client";

import { useState } from "react";
import type { OrderDetailItem } from "@/lib/orders/get-order-detail";
import type { KitchenTicketData } from "@/lib/printing/types";
import type { OrderItemInput } from "@/lib/orders/build-order-items";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { addItemsToOrder, removeOrderItem } from "@/app/order-aktif/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/ui/price-text";
import { QtyStepper } from "@/components/ui/qty-stepper";

// One more portion of exactly this line: same product, add-ons and note (a
// custom item: same name and price). The server re-reads every price and
// folds it into this line only if the portion price is unchanged
// (addItemsToOrder), so "+" can never sell at a stale price.
function onePortionOf(item: OrderDetailItem): OrderItemInput {
  if (item.isCustom) {
    return { kind: "custom", name: item.productName, price: item.unitPrice, notes: item.notes ?? "", qty: 1 };
  }
  return {
    kind: "product",
    productId: item.productId,
    addonOptionIds: item.addons.map((a) => a.addonOptionId),
    notes: item.notes ?? "",
    qty: 1,
  };
}

// One line of a SAVED order (order detail, Pembayaran). While the order is
// still OPEN it can be corrected in place with [ − ] qty [ + ]: "−" takes one
// portion off, "−" at 1 asks once inline before deleting the whole line, "+"
// adds one identical portion (and offers a TAMBAHAN kitchen slip, like any
// other addition). The last portion of the order can't be removed — emptying
// an order is "Batalkan Order" with a reason (CLAUDE.md "Order & status").
// Every rule is re-checked on the server: a PAID/closed order is refused by
// removeOrderItem / addItemsToOrder no matter what this screen shows.
export function SavedOrderItemRow({
  orderId,
  item,
  editable,
  canRemove,
  onChanged,
  onEdit,
  onKitchenTicket,
}: {
  orderId: string;
  item: OrderDetailItem;
  editable: boolean;
  // false when this is the order's last remaining portion.
  canRemove: boolean;
  onChanged: () => void;
  // Reopens the add-on sheet; omitted where editing isn't offered.
  onEdit?: () => void;
  onKitchenTicket?: (ticket: KitchenTicketData) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(mode: "one" | "all") {
    setBusy(true);
    setError(null);
    try {
      const result = await removeOrderItem(orderId, item.id, mode);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function addOne() {
    setBusy(true);
    setError(null);
    try {
      const result = await addItemsToOrder(orderId, [onePortionOf(item)]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChanged();
      if (result.kitchenTicket) onKitchenTicket?.(result.kitchenTicket);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5 p-3">
      <div className="flex justify-between gap-3">
        <span className="text-base font-semibold text-ink">
          {item.qty}x {item.productName}
          {item.isCustom && (
            <span className="ml-2 inline-block align-middle">
              <Badge variant="warning">Custom</Badge>
            </span>
          )}
        </span>
        <PriceText amount={item.lineTotal} weight="secondary" />
      </div>
      {(item.addons.length > 0 || item.notes) && (
        <span className="text-ink-muted text-sm">
          {[groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", "), item.notes]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}

      {editable && !confirming && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <QtyStepper
            qty={item.qty}
            label={item.productName}
            disabled={busy}
            decrementDisabled={!canRemove}
            onDecrement={() => (item.qty > 1 ? remove("one") : setConfirming(true))}
            onIncrement={addOne}
          />
          {/* A custom item ("+ Item Custom") has no real Product behind it
              to reopen an addon sheet for (owner's scope, 22 Sep 2026). */}
          {onEdit && !item.isCustom && (
            <Button variant="secondary" size="compact" disabled={busy} onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      )}
      {editable && !confirming && !canRemove && (
        <p className="text-ink-faint text-xs">Item terakhir — untuk mengosongkan order pakai Batalkan Order.</p>
      )}
      {editable && confirming && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-ink text-sm font-medium">Hapus {item.productName}?</span>
          <Button variant="danger" disabled={busy} onClick={() => remove("all")}>
            {busy ? "Menghapus..." : "Ya, hapus"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Batal
          </Button>
        </div>
      )}
      {error && <p className="text-danger mt-1 text-sm">{error}</p>}
    </div>
  );
}
