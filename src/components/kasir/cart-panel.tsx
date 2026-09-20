"use client";

import { motion, AnimatePresence } from "motion/react";
import type { CartItem, ChannelType, TableLabel } from "@/lib/cart/types";
import { computeOrderTotals } from "@/lib/orders/pricing";
import { sortOrderLines, PORTION_COUNT_VISIBLE_FROM } from "@/lib/orders/line-order";
import { totalItemCount } from "@/lib/printing/format";
import { Button } from "@/components/ui/button";
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
  customerName,
  onCustomerNameChange,
  saving,
  saveError,
  lastAddedLocalId,
  onEdit,
  onRemove,
  onSave,
  saveLabel = "Simpan Pesanan",
  variant = "sidebar",
  onClose,
}: {
  items: CartItem[];
  channel: ChannelType | null;
  tableLabel: TableLabel | null;
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  saving: boolean;
  saveError: string | null;
  lastAddedLocalId: string | null;
  onEdit: (item: CartItem) => void;
  onRemove: (localId: string) => void;
  onSave: () => void;
  saveLabel?: string;
  variant?: "sidebar" | "sheet";
  onClose?: () => void;
}) {
  const totals = computeOrderTotals(items, channel);
  const canSave =
    !!channel && items.length > 0 && !saving && (channel !== "DINE_IN" || !!tableLabel);

  // Category then product name, so like sits with like however it was tapped
  // in. Purely a display order — what gets saved is still draft.items.
  const sortedItems = sortOrderLines(items);
  const portions = totalItemCount(items);
  // Only once it's more than you can count at a glance (see line-order.ts).
  const portionLabel = portions >= PORTION_COUNT_VISIBLE_FROM ? `${portions} item` : null;

  const itemList =
    items.length === 0 ? (
      <p className="py-8 text-center text-sm text-ink-faint">Belum ada item</p>
    ) : (
      <AnimatePresence initial={false}>
        {sortedItems.map((item) => (
          <motion.div
            key={item.localId}
            initial={item.localId === lastAddedLocalId ? { opacity: 0, scale: 0.97 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <CartItemRow item={item} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.localId)} />
          </motion.div>
        ))}
      </AnimatePresence>
    );

  const footer = (
    <>
      {items.length > 0 && (
        <input
          type="text"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="Nama (opsional)"
          className="rounded-input border-border mb-2 h-11 w-full border px-3 text-sm"
        />
      )}

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
        title={portionLabel ? `Keranjang · ${portionLabel}` : "Keranjang"}
        onClose={onClose ?? (() => {})}
        footer={footer}
      >
        {itemList}
      </Sheet>
    );
  }

  return (
    <div className="border-border bg-surface shadow-panel relative z-10 flex h-full w-full flex-col border-l">
      <div className="border-border flex items-baseline justify-between border-b px-3 py-2">
        <h2 className="text-base font-bold text-ink">Keranjang</h2>
        {portionLabel && <span className="text-ink-muted text-sm font-medium">{portionLabel}</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4">{itemList}</div>

      <div className="border-border border-t p-3">{footer}</div>
    </div>
  );
}
