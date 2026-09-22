"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import type { MenuCategory, MenuProduct } from "@/lib/menu/get-active-menu";
import { useCartDraft } from "@/lib/cart/use-cart-draft";
import { expandAddonOptionIds, type CartItem } from "@/lib/cart/types";
import type { ComboShortcut } from "@/lib/combo/types";
import { MainMenu } from "@/components/ui/main-menu";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { Sheet } from "@/components/ui/sheet";
import { SheetItem } from "@/components/ui/sheet-motion";
import { LinkButton } from "@/components/ui/link-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { PreorderReminderBanner } from "@/components/ui/preorder-reminder-banner";
import type { PreOrderReminder } from "@/lib/orders/get-preorders";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver } from "@/lib/printing/types";
import { useKitchenTicketPrompt } from "@/components/printing/use-kitchen-ticket-prompt";
import { ChannelTableBar } from "./channel-table-bar";
import { CategoryTabs } from "./category-tabs";
import { ProductGrid } from "./product-grid";
import { ComboShortcutRow } from "./combo-shortcut-row";
import { AddonSheet, type AddonSheetResult } from "./addon-sheet";
import { CartPanel } from "./cart-panel";
import { CartBar } from "./cart-bar";
import { saveOrder } from "@/app/kasir/actions";

type SheetTarget = { mode: "add"; product: MenuProduct } | { mode: "edit"; product: MenuProduct; item: CartItem };

export function KasirScreen({
  categories,
  comboShortcuts,
  nav,
  shiftOpen,
  preorderReminders,
  printerDriver,
  kitchenTicketEnabled,
}: {
  categories: MenuCategory[];
  comboShortcuts: ComboShortcut[];
  nav: HeaderNav;
  preorderReminders: PreOrderReminder[];
  // false only for an OWNER looking at Kasir before opening the shift (a
  // CASHIER never gets here — see kasir/page.tsx). The screen stays fully
  // browsable; only saving is blocked, and the server blocks it too.
  shiftOpen: boolean;
  printerDriver: PrinterDriver;
  // Off (default, 22 Sep 2026): no "Cetak kertas dapur?" prompt at all — see
  // CLAUDE.md "Kertas dapur".
  kitchenTicketEnabled: boolean;
}) {
  const router = useRouter();
  const { draft, setChannel, setTableLabel, setCustomerName, upsertItem, removeItem, clear } = useCartDraft();
  const { offer: offerKitchenTicket, prompt: kitchenTicketPrompt } = useKitchenTicketPrompt({ printerDriver });
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const [lastAddedLocalId, setLastAddedLocalId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [noShiftPopup, setNoShiftPopup] = useState(false);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  const cartQtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of draft.items) map[item.productId] = (map[item.productId] ?? 0) + item.qty;
    return map;
  }, [draft.items]);

  function handleTapProduct(product: MenuProduct) {
    setSavedNotice(null);
    if (product.addonGroups.length > 0) {
      setSheetTarget({ mode: "add", product });
      return;
    }

    // Simple item, no customization possible — repeated taps bump qty on
    // the same line instead of piling up identical rows.
    setLastAddedLocalId(
      upsertItem({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        addons: [],
        notes: "",
        qty: 1,
        isDeliveryChargeable: product.isDeliveryChargeable,
        categorySortOrder: product.categorySortOrder,
        productSortOrder: product.productSortOrder,
      }),
    );
  }

  function handleTapCombo(item: Omit<CartItem, "localId">) {
    setSavedNotice(null);
    setLastAddedLocalId(upsertItem(item));
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
      categorySortOrder: product.categorySortOrder,
        productSortOrder: product.productSortOrder,
    };

    // Adding a second identical customisation merges with the first, and so
    // does editing one line until it matches another — both go through the
    // same upsert, so neither can leave a duplicate row behind.
    const localId = upsertItem(item, sheetTarget.mode === "edit" ? sheetTarget.item.localId : null);
    setLastAddedLocalId(sheetTarget.mode === "edit" ? null : localId);
    setSheetTarget(null);
  }

  async function handleSave() {
    if (!draft.channel) return;
    // UI half of the block only — saveOrder() refuses a missing shift on
    // the server regardless of what the screen does here.
    if (!shiftOpen) {
      setNoShiftPopup(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveOrder({
        channel: draft.channel,
        tableLabel: draft.tableLabel,
        customerName: draft.customerName.trim() || null,
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
      setSavedNotice(`Order #${result.queueNumber} tersimpan.`);
      setCartSheetOpen(false);
      router.refresh();
      if (kitchenTicketEnabled && result.kitchenTicket) offerKitchenTicket(result.kitchenTicket);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      {kitchenTicketPrompt}
      {/* Late orders first: those are food already waiting, the pre-order
          bar is about food not started yet. */}
      <LateOrderBanner lateCount={nav.lateCount} />
      <PreorderReminderBanner reminders={preorderReminders} />
      {!shiftOpen && (
        <div className="bg-danger flex flex-wrap items-center justify-center gap-3 px-3 py-2 text-white">
          <span className="text-base font-bold">Kasir belum dibuka — pesanan tidak bisa disimpan</span>
          <Link
            href="/shift/buka"
            className="rounded-pill bg-surface text-danger flex h-10 items-center px-4 text-sm font-bold"
          >
            Buka Shift
          </Link>
        </div>
      )}
      {/* One header surface. Tablet (lg): a single row — Menu, channel/table
          picks, Order Aktif. Narrower: two clearly separate rows — Menu +
          title + Order Aktif on top, the channel row full-width below — so
          the channel buttons are never covered. Same elements, CSS order. */}
      <header className="border-border bg-surface flex flex-wrap items-center gap-x-2 gap-y-2 border-b px-3 py-2 [@media(max-height:500px)]:py-1">
        <div className="order-1">
          <MainMenu isOwner={nav.isOwner} />
        </div>
        <h1 className="text-ink order-2 min-w-0 flex-1 truncate text-lg font-bold lg:hidden [@media(max-height:500px)]:hidden">
          Kasir
        </h1>
        <div className="order-4 w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1 [@media(max-height:500px)]:order-2 [@media(max-height:500px)]:w-auto [@media(max-height:500px)]:flex-1">
          <ChannelTableBar
            channel={draft.channel}
            tableLabel={draft.tableLabel}
            onChannel={setChannel}
            onTableLabel={setTableLabel}
            customerName={draft.customerName}
            onCustomerNameChange={setCustomerName}
          />
        </div>
        <div className="order-3">
          <OrderAktifButton activeCount={nav.activeCount} lateCount={nav.lateCount} />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="bg-canvas flex flex-1 flex-col overflow-hidden">
          <CategoryTabs
            categories={categories}
            activeId={activeCategory?.id ?? ""}
            onSelect={setActiveCategoryId}
          />
          <ComboShortcutRow shortcuts={comboShortcuts} categories={categories} onTap={handleTapCombo} />
          {savedNotice && (
            <div className="bg-primary-soft text-primary-strong px-3 py-1.5 text-sm font-medium">{savedNotice}</div>
          )}
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
            saving={saving}
            saveError={saveError}
            lastAddedLocalId={lastAddedLocalId}
            onEdit={handleEditItem}
            onRemove={removeItem}
            onSave={handleSave}
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
            saving={saving}
            saveError={saveError}
            lastAddedLocalId={lastAddedLocalId}
            onEdit={handleEditItem}
            onRemove={removeItem}
            onSave={handleSave}
            onClose={() => setCartSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {noShiftPopup && (
          <Sheet title="Shift belum dibuka" onClose={() => setNoShiftPopup(false)}>
            <div className="flex flex-col gap-4 pb-2">
              <SheetItem index={0}>
                <p className="text-ink text-base">
                  Pesanan belum bisa disimpan karena kasir belum dibuka hari ini. Buka shift dulu — isi keranjang
                  tidak hilang.
                </p>
              </SheetItem>
              <SheetItem index={1}>
                <LinkButton href="/shift/buka" variant="primary" size="large" fullWidth>
                  Buka Shift
                </LinkButton>
              </SheetItem>
            </div>
          </Sheet>
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
