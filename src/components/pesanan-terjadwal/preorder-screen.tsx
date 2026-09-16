"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import type { MenuCategory, MenuProduct } from "@/lib/menu/get-active-menu";
import { useCartDraft } from "@/lib/cart/use-cart-draft";
import { sameCartLine, expandAddonOptionIds, type CartItem } from "@/lib/cart/types";
import type { ComboShortcut } from "@/lib/combo/types";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { ChannelTableBar } from "@/components/kasir/channel-table-bar";
import { CategoryTabs } from "@/components/kasir/category-tabs";
import { ProductGrid } from "@/components/kasir/product-grid";
import { ComboShortcutRow } from "@/components/kasir/combo-shortcut-row";
import { AddonSheet, type AddonSheetResult } from "@/components/kasir/addon-sheet";
import { CartPanel } from "@/components/kasir/cart-panel";
import { CartBar } from "@/components/kasir/cart-bar";
import { savePreOrder } from "@/app/pesanan-terjadwal/actions";

const PREORDER_STORAGE_KEY = "pos-mi-ayam:preorder-draft";

type SheetTarget = { mode: "add"; product: MenuProduct } | { mode: "edit"; product: MenuProduct; item: CartItem };

// Same cart-building shape as KasirScreen (product grid, addon sheet, cart
// panel) but for a pre-order: no shift required to create (see CLAUDE.md
// "Pre-order" — these are taken over WhatsApp while the warung is closed),
// plus a required delivery date/time and a required customer name, since
// there's no queue number to identify it by until it's paid. Uses a
// separate localStorage draft key so an in-progress walk-in cart on the
// same device is never clobbered by an in-progress pre-order, or vice versa.
export function PreOrderScreen({
  categories,
  comboShortcuts,
  orderAktifIndicator,
}: {
  categories: MenuCategory[];
  comboShortcuts: ComboShortcut[];
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();
  const { draft, setChannel, setTableLabel, setCustomerName, addItem, replaceItem, removeItem, clear } =
    useCartDraft(PREORDER_STORAGE_KEY);
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const [lastAddedLocalId, setLastAddedLocalId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  const cartQtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of draft.items) map[item.productId] = (map[item.productId] ?? 0) + item.qty;
    return map;
  }, [draft.items]);

  function handleTapProduct(product: MenuProduct) {
    setSaveError(null);
    if (product.addonGroups.length > 0) {
      setSheetTarget({ mode: "add", product });
      return;
    }

    const existing = draft.items.find(
      (i) => i.productId === product.id && i.addons.length === 0 && !i.notes,
    );
    if (existing) {
      replaceItem(existing.localId, { ...existing, qty: existing.qty + 1 });
      setLastAddedLocalId(existing.localId);
    } else {
      const localId = addItem({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        addons: [],
        notes: "",
        qty: 1,
        isDeliveryChargeable: product.isDeliveryChargeable,
      });
      setLastAddedLocalId(localId);
    }
  }

  function handleTapCombo(item: Omit<CartItem, "localId">) {
    setSaveError(null);
    const existing = draft.items.find((i) => sameCartLine(i, item));
    if (existing) {
      replaceItem(existing.localId, { ...existing, qty: existing.qty + item.qty });
      setLastAddedLocalId(existing.localId);
    } else {
      const localId = addItem(item);
      setLastAddedLocalId(localId);
    }
  }

  function handleEditItem(item: CartItem) {
    const product = categories.flatMap((c) => c.products).find((p) => p.id === item.productId);
    if (!product) return;
    setSheetTarget({ mode: "edit", product, item });
  }

  function handleConfirmSheet(result: AddonSheetResult) {
    if (!sheetTarget) return;
    const { product } = sheetTarget;
    const item: Omit<CartItem, "localId"> = {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      addons: result.addons,
      notes: result.notes,
      qty: result.qty,
      isDeliveryChargeable: product.isDeliveryChargeable,
    };

    if (sheetTarget.mode === "edit") {
      replaceItem(sheetTarget.item.localId, item);
      setLastAddedLocalId(null);
    } else {
      const localId = addItem(item);
      setLastAddedLocalId(localId);
    }
    setSheetTarget(null);
  }

  async function handleSave() {
    if (!draft.channel) return;
    if (!draft.customerName.trim()) {
      setSaveError("Isi nama pemesan dulu — belum ada nomor antrian untuk pre-order.");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setSaveError("Isi tanggal & jam kirim dulu.");
      return;
    }
    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      setSaveError("Tanggal & jam kirim harus di masa depan.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await savePreOrder({
        channel: draft.channel,
        tableLabel: draft.tableLabel,
        customerName: draft.customerName.trim(),
        scheduledFor: scheduledFor.toISOString(),
        items: draft.items.map((i) => ({
          productId: i.productId,
          addonOptionIds: expandAddonOptionIds(i.addons),
          notes: i.notes,
          qty: i.qty,
        })),
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      clear();
      setCartSheetOpen(false);
      router.push("/pesanan-terjadwal");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-ink">Pre-order Baru</h1>
          <div className="flex items-center gap-2">
            <OrderAktifButton
              activeCount={orderAktifIndicator.activeCount}
              lateCount={orderAktifIndicator.lateCount}
            />
            <Link href="/pesanan-terjadwal" className="rounded-pill bg-muted flex h-12 items-center px-4 text-sm font-semibold text-ink">
              Batal
            </Link>
            <SignOutButton />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-ink-muted text-sm font-medium" htmlFor="scheduledDate">
            Kirim
          </label>
          <input
            id="scheduledDate"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="rounded-input border-border h-12 border px-3 text-base"
          />
          <input
            id="scheduledTime"
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="rounded-input border-border h-12 border px-3 text-base"
          />
        </div>
      </div>

      <ChannelTableBar
        channel={draft.channel}
        tableLabel={draft.tableLabel}
        onChannel={setChannel}
        onTableLabel={setTableLabel}
      />

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="bg-canvas flex flex-1 flex-col overflow-hidden">
          <CategoryTabs
            categories={categories}
            activeId={activeCategory?.id ?? ""}
            onSelect={setActiveCategoryId}
          />
          <ComboShortcutRow shortcuts={comboShortcuts} categories={categories} onTap={handleTapCombo} />
          <ProductGrid
            products={activeCategory?.products ?? []}
            cartQtyByProduct={cartQtyByProduct}
            onTapProduct={handleTapProduct}
            className="pb-24 lg:pb-2"
          />
        </div>

        <div className="hidden w-[340px] shrink-0 lg:block">
          <CartPanel
            items={draft.items}
            channel={draft.channel}
            tableLabel={draft.tableLabel}
            customerName={draft.customerName}
            onCustomerNameChange={setCustomerName}
            saving={saving}
            saveError={saveError}
            lastAddedLocalId={lastAddedLocalId}
            onEdit={handleEditItem}
            onRemove={removeItem}
            onSave={handleSave}
            saveLabel="Simpan Pre-order"
          />
        </div>
      </div>

      <CartBar items={draft.items} channel={draft.channel} onTap={() => setCartSheetOpen(true)} />

      <AnimatePresence>
        {cartSheetOpen && (
          <CartPanel
            variant="sheet"
            items={draft.items}
            channel={draft.channel}
            tableLabel={draft.tableLabel}
            customerName={draft.customerName}
            onCustomerNameChange={setCustomerName}
            saving={saving}
            saveError={saveError}
            lastAddedLocalId={lastAddedLocalId}
            onEdit={handleEditItem}
            onRemove={removeItem}
            onSave={handleSave}
            saveLabel="Simpan Pre-order"
            onClose={() => setCartSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheetTarget && (
          <AddonSheet
            key={sheetTarget.product.id + (sheetTarget.mode === "edit" ? sheetTarget.item.localId : "add")}
            product={sheetTarget.product}
            initial={
              sheetTarget.mode === "edit"
                ? {
                    addons: sheetTarget.item.addons,
                    notes: sheetTarget.item.notes,
                    qty: sheetTarget.item.qty,
                  }
                : undefined
            }
            onConfirm={handleConfirmSheet}
            onClose={() => setSheetTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
