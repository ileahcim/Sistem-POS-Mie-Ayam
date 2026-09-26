"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import type { MenuCategory, MenuProduct } from "@/lib/menu/get-active-menu";
import type { CartItem } from "@/lib/cart/types";
import { cartItemLineTotal, cartItemToOrderItemInput, customGroupingKey, upsertCartLine } from "@/lib/cart/types";
import { portionPriceOf, sortOrderLines } from "@/lib/orders/line-order";
import { formatAddonWithQty } from "@/lib/printing/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { CategoryTabs } from "@/components/kasir/category-tabs";
import { ProductGrid } from "@/components/kasir/product-grid";
import { AddonSheet, type AddonSheetResult } from "@/components/kasir/addon-sheet";
import { CustomItemSheet, type CustomItemResult } from "@/components/kasir/custom-item-sheet";
import { addItemsToOrder } from "@/app/order-aktif/actions";
import type { PrinterDriver } from "@/lib/printing/types";
import { useKitchenTicketPrompt } from "@/components/printing/use-kitchen-ticket-prompt";

// Shared by the order detail screen and the payment screen — both need the
// same "one more forgotten item" affordance on an OPEN order. Confirmed
// additions are saved immediately (server-snapshotted, see
// buildOrderItemsCreateData), not staged for the caller to save later.
//
// While the panel is open its Batal / "Tambah N Item ke Order" bar is portaled
// into the screen's bottom bar (`footer`), and the caller hides its own
// "Lanjut ke Pembayaran" / "Bayar" there (`onOpenChange`). Field problem (26
// Sep 2026): in a rush the confirm button sat below the product grid, the
// sticky pay button was the one in view, and tapped items were never added.
export function AddItemsPanel({
  orderId,
  menu,
  onAdded,
  printerDriver,
  kitchenTicketEnabled,
  footer,
  onOpenChange,
}: {
  orderId: string;
  menu: MenuCategory[];
  onAdded: () => void;
  printerDriver: PrinterDriver;
  // Off (default, 22 Sep 2026): no "Cetak kertas dapur?" (TAMBAHAN) prompt at
  // all — see CLAUDE.md "Kertas dapur".
  kitchenTicketEnabled: boolean;
  // The screen's bottom bar; null (not mounted yet) keeps the bar inline.
  footer: HTMLElement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(menu[0]?.id ?? "");
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [sheetProduct, setSheetProduct] = useState<MenuProduct | null>(null);
  const [customItemSheetOpen, setCustomItemSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { offer: offerKitchenTicket, prompt: kitchenTicketPrompt } = useKitchenTicketPrompt({ printerDriver });

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange(next);
  }

  const activeCategory = menu.find((c) => c.id === activeCategoryId) ?? menu[0];
  const cartQtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of pendingItems) map[item.productId] = (map[item.productId] ?? 0) + item.qty;
    return map;
  }, [pendingItems]);

  function handleTapProduct(product: MenuProduct) {
    if (product.addonGroups.length > 0) {
      setSheetProduct(product);
      return;
    }
    setPendingItems(
      (items) =>
        upsertCartLine(items, {
          productId: product.id,
          productName: product.name,
          isCustom: false,
          unitPrice: product.price,
          addons: [],
          notes: "",
          qty: 1,
          isDeliveryChargeable: product.isDeliveryChargeable,
          categorySortOrder: product.categorySortOrder,
          productSortOrder: product.productSortOrder,
        }).items,
    );
  }

  // "+ Item Custom" — always treated as Makanan for reading order/kertas
  // dapur (owner's explicit call, CLAUDE.md "Kertas dapur"). Read Makanan's
  // live sortOrder from the menu already on screen rather than hardcoding it.
  function handleConfirmCustomItem(result: CustomItemResult) {
    const makanan = menu.find((c) => c.name === "Makanan");
    setPendingItems(
      (items) =>
        upsertCartLine(items, {
          productId: customGroupingKey(result.name),
          productName: result.name,
          isCustom: true,
          unitPrice: result.price,
          addons: [],
          notes: "",
          qty: result.qty,
          isDeliveryChargeable: true,
          categorySortOrder: makanan?.sortOrder ?? 0,
          productSortOrder: Number.MAX_SAFE_INTEGER,
        }).items,
    );
    setCustomItemSheetOpen(false);
  }

  function handleConfirmSheet(result: AddonSheetResult) {
    if (!sheetProduct) return;
    // Same merge rule as the cart — a second identical customisation bumps
    // qty instead of adding a twin row.
    setPendingItems(
      (items) =>
        upsertCartLine(items, {
          productId: sheetProduct.id,
          productName: sheetProduct.name,
          isCustom: false,
          unitPrice: sheetProduct.price,
          addons: result.addons,
          notes: result.notes,
          qty: result.qty,
          isDeliveryChargeable: sheetProduct.isDeliveryChargeable,
          categorySortOrder: sheetProduct.categorySortOrder,
          productSortOrder: sheetProduct.productSortOrder,
        }).items,
    );
    setSheetProduct(null);
  }

  async function handleConfirmAdd() {
    if (pendingItems.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const result = await addItemsToOrder(orderId, pendingItems.map(cartItemToOrderItemInput));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPendingItems([]);
      setOpen(false);
      onAdded();
      if (kitchenTicketEnabled && result.kitchenTicket) offerKitchenTicket(result.kitchenTicket);
    } finally {
      setSaving(false);
    }
  }

  const pendingPortions = pendingItems.reduce((sum, item) => sum + item.qty, 0);
  const actionBar = (
    <div className="flex w-full flex-col gap-2">
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="large"
          fullWidth
          onClick={() => {
            setOpen(false);
            setPendingItems([]);
            setError(null);
          }}
        >
          Batal
        </Button>
        <Button
          variant="primary"
          size="large"
          fullWidth
          disabled={pendingItems.length === 0 || saving}
          onClick={handleConfirmAdd}
        >
          {saving
            ? "Menyimpan..."
            : pendingPortions > 0
              ? `Tambah ${pendingPortions} Item ke Order`
              : "Pilih item dulu"}
        </Button>
      </div>
    </div>
  );

  if (!open) {
    return (
      <>
        {kitchenTicketPrompt}
        <Button variant="ghost" size="default" fullWidth onClick={() => setOpen(true)}>
          + Tambah Item
        </Button>
      </>
    );
  }

  return (
    <Card className="overflow-hidden">
      {kitchenTicketPrompt}
      <CategoryTabs categories={menu} activeId={activeCategory?.id ?? ""} onSelect={setActiveCategoryId} />
      <ProductGrid
        products={activeCategory?.products ?? []}
        cartQtyByProduct={cartQtyByProduct}
        onTapProduct={handleTapProduct}
      />

      <div className="border-border border-t p-3">
        <Button variant="ghost" size="default" fullWidth onClick={() => setCustomItemSheetOpen(true)}>
          + Item Custom
        </Button>
      </div>

      {pendingItems.length > 0 && (
        <div className="border-border border-t p-3">
          <div className="flex flex-col gap-2">
            {sortOrderLines(pendingItems, portionPriceOf).map((item) => (
              <div key={item.localId} className="flex justify-between text-sm">
                <span className="text-ink font-medium">
                  {item.qty}x {item.productName}
                  {item.addons.length > 0 && (
                    <span className="text-ink-faint"> ({item.addons.map(formatAddonWithQty).join(", ")})</span>
                  )}
                </span>
                <PriceText amount={cartItemLineTotal(item)} weight="secondary" />
              </div>
            ))}
          </div>
        </div>
      )}

      {footer ? createPortal(actionBar, footer) : <div className="border-border border-t p-3">{actionBar}</div>}

      <AnimatePresence>
        {sheetProduct && (
          <AddonSheet product={sheetProduct} onConfirm={handleConfirmSheet} onClose={() => setSheetProduct(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {customItemSheetOpen && (
          <CustomItemSheet onConfirm={handleConfirmCustomItem} onClose={() => setCustomItemSheetOpen(false)} />
        )}
      </AnimatePresence>
    </Card>
  );
}
