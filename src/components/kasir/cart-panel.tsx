"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { CartItem, ChannelType, TableLabel } from "@/lib/cart/types";
import { computeOrderTotals } from "@/lib/orders/pricing";
import { portionPriceOf, sortOrderLines } from "@/lib/orders/line-order";
import { Button } from "@/components/ui/button";
import { OrderLineList, PortionTotalRow } from "@/components/ui/order-line-list";
import { PriceText } from "@/components/ui/price-text";
import { Sheet } from "@/components/ui/sheet";
import { CartItemRow } from "./cart-item-row";

// Two shells around the same cart content: "sidebar" (default) is the
// always-visible tablet/desktop column; "sheet" is the same content dropped
// into the shared bottom-Sheet chrome for the mobile layout (see CartBar) —
// see CLAUDE.md-worthy note in kasir-screen.tsx for why the breakpoint is
// where it is. Keeping both variants in one component means the item list
// and totals/validation logic can never drift out of sync between them.
export function CartPanel({
  items,
  channel,
  tableLabel,
  saving,
  saveError,
  lastAddedLocalId,
  onEdit,
  onRemove,
  onSave,
  saveLabel = "Simpan Pesanan",
  footerExtra,
  variant = "sidebar",
  onClose,
}: {
  items: CartItem[];
  channel: ChannelType | null;
  tableLabel: TableLabel | null;
  saving: boolean;
  saveError: string | null;
  lastAddedLocalId: string | null;
  onEdit: (item: CartItem) => void;
  onRemove: (localId: string) => void;
  onSave: () => void;
  saveLabel?: string;
  // Optional block rendered right under Total, above the save button.
  footerExtra?: ReactNode;
  variant?: "sidebar" | "sheet";
  onClose?: () => void;
}) {
  const totals = computeOrderTotals(items, channel);
  const canSave =
    !!channel && items.length > 0 && !saving && (channel !== "DINE_IN" || !!tableLabel);

  // Category, product, cheapest variant first — however it was tapped in —
  // and on a big order the per-product counts (see line-order.ts). Purely a
  // display order: what gets saved is still draft.items.
  const sortedItems = sortOrderLines(items, portionPriceOf);

  const itemList =
    items.length === 0 ? (
      <p className="py-8 text-center text-sm text-ink-faint">Belum ada item</p>
    ) : (
      // No AnimatePresence around this: rows are nested inside OrderLineList,
      // and a presence context with initial={false} would stop a NEW row from
      // playing its entry flash. `initial` below already skips every other row.
      <OrderLineList
          lines={sortedItems}
          keyOf={(item) => item.localId}
          renderLine={(item) => (
            <motion.div
              initial={item.localId === lastAddedLocalId ? { opacity: 0, scale: 0.97 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <CartItemRow item={item} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.localId)} />
            </motion.div>
          )}
        />
    );

  const footer = (
    <>
      <PortionTotalRow lines={items} className="mb-1" />
      <div className="flex justify-between text-sm text-ink-muted">
        <span>Subtotal</span>
        <PriceText amount={totals.subtotal} weight="secondary" />
      </div>
      {totals.deliveryFee > 0 && (
        <div className="mt-1 flex justify-between text-sm text-ink-muted">
          <span>Ongkir</span>
          <PriceText amount={totals.deliveryFee} weight="secondary" />
        </div>
      )}
      <div className="border-border mt-1.5 flex items-center justify-between border-t pt-1.5">
        <span className="text-base font-bold text-ink">Total</span>
        <PriceText amount={totals.total} weight="total" />
      </div>

      {items.length > 0 && footerExtra}

      {saveError && <p className="text-danger mt-1.5 text-sm">{saveError}</p>}
      {!saveError && !channel && items.length > 0 && (
        <p className="text-warning mt-1.5 text-sm">Pilih channel dulu di atas.</p>
      )}
      {!saveError && channel === "DINE_IN" && !tableLabel && items.length > 0 && (
        <p className="text-warning mt-1.5 text-sm">Pilih meja dulu di atas.</p>
      )}

      <Button variant="primary" size="large" fullWidth disabled={!canSave} onClick={onSave} className="mt-2">
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Menyimpan...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M4 9.5 7.2 12.7 14 5.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {saveLabel}
          </span>
        )}
      </Button>
    </>
  );

  if (variant === "sheet") {
    return (
      <Sheet
        title="Keranjang"
        onClose={onClose ?? (() => {})}
        footer={footer}
      >
        {itemList}
      </Sheet>
    );
  }

  return (
    <div className="border-border bg-surface shadow-panel relative z-10 flex h-full w-full flex-col border-l">
      <div className="border-border border-b px-3 py-2">
        <h2 className="text-base font-bold text-ink">Keranjang</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4">{itemList}</div>

      <div className="border-border border-t p-3">{footer}</div>
    </div>
  );
}
