"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { MenuCategory, MenuProduct } from "@/lib/menu/get-active-menu";
import type { CartItem } from "@/lib/cart/types";
import { cartItemLineTotal, expandAddonOptionIds, upsertCartLine } from "@/lib/cart/types";
import { portionPriceOf, sortOrderLines } from "@/lib/orders/line-order";
import { formatAddonWithQty } from "@/lib/printing/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceText } from "@/components/ui/price-text";
import { CategoryTabs } from "@/components/kasir/category-tabs";
import { ProductGrid } from "@/components/kasir/product-grid";
import { AddonSheet, type AddonSheetResult } from "@/components/kasir/addon-sheet";
import { addItemsToOrder } from "@/app/order-aktif/actions";

// Shared by the order detail screen and the payment screen — both need the
// same "one more forgotten item" affordance on an OPEN order. Confirmed
// additions are saved immediately (server-snapshotted, see
// buildOrderItemsCreateData), not staged for the caller to save later.
export function AddItemsPanel({
  orderId,
  menu,
  onAdded,
}: {
  orderId: string;
  menu: MenuCategory[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(menu[0]?.id ?? "");
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [sheetProduct, setSheetProduct] = useState<MenuProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function handleConfirmSheet(result: AddonSheetResult) {
    if (!sheetProduct) return;
    // Same merge rule as the cart — a second identical customisation bumps
    // qty instead of adding a twin row.
    setPendingItems(
      (items) =>
        upsertCartLine(items, {
          productId: sheetProduct.id,
          productName: sheetProduct.name,
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
      const result = await addItemsToOrder(
        orderId,
        pendingItems.map((i) => ({
          productId: i.productId,
          addonOptionIds: expandAddonOptionIds(i.addons),
          notes: i.notes,
          qty: i.qty,
        })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPendingItems([]);
      setOpen(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="default" fullWidth onClick={() => setOpen(true)}>
        + Tambah Item
      </Button>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CategoryTabs categories={menu} activeId={activeCategory?.id ?? ""} onSelect={setActiveCategoryId} />
      <ProductGrid
        products={activeCategory?.products ?? []}
        cartQtyByProduct={cartQtyByProduct}
        onTapProduct={handleTapProduct}
      />

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

      {error && <p className="text-danger px-3 pb-2 text-sm">{error}</p>}

      <div className="border-border flex gap-2 border-t p-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setOpen(false);
            setPendingItems([]);
            setError(null);
          }}
        >
          Batal
        </Button>
        <Button variant="primary" fullWidth disabled={pendingItems.length === 0 || saving} onClick={handleConfirmAdd}>
          {saving ? "Menyimpan..." : `Tambah ${pendingItems.length || ""} Item ke Order`}
        </Button>
      </div>

      <AnimatePresence>
        {sheetProduct && (
          <AddonSheet product={sheetProduct} onConfirm={handleConfirmSheet} onClose={() => setSheetProduct(null)} />
        )}
      </AnimatePresence>
    </Card>
  );
}
