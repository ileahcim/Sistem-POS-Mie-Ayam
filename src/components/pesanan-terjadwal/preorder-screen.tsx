"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { MenuCategory, MenuProduct } from "@/lib/menu/get-active-menu";
import { useCartDraft } from "@/lib/cart/use-cart-draft";
import { expandAddonOptionIds, type CartItem } from "@/lib/cart/types";
import type { ComboShortcut } from "@/lib/combo/types";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { PrinterDriver } from "@/lib/printing/types";
import { computeOrderTotals } from "@/lib/orders/pricing";
import { AppHeader } from "@/components/ui/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { ChannelTableBar } from "@/components/kasir/channel-table-bar";
import { CategoryTabs } from "@/components/kasir/category-tabs";
import { ProductGrid } from "@/components/kasir/product-grid";
import { ComboShortcutRow } from "@/components/kasir/combo-shortcut-row";
import { AddonSheet, type AddonSheetResult } from "@/components/kasir/addon-sheet";
import { CartPanel } from "@/components/kasir/cart-panel";
import { CartBar } from "@/components/kasir/cart-bar";
import { savePreOrder } from "@/app/pesanan-terjadwal/actions";
import { DepositPicker, initialDepositDraft, type DepositDraft } from "./deposit-picker";
import { useDepositReceiptPrompt } from "./use-deposit-receipt-prompt";

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
  nav,
  cashDepositAvailable,
  autoPrintReceipt,
  printerDriver,
}: {
  categories: MenuCategory[];
  comboShortcuts: ComboShortcut[];
  nav: HeaderNav;
  // A cash DP needs an open shift (it goes into the drawer); QRIS never does.
  cashDepositAvailable: boolean;
  autoPrintReceipt: boolean;
  printerDriver: PrinterDriver;
}) {
  const router = useRouter();
  const { draft, setChannel, setTableLabel, setCustomerName, upsertItem, removeItem, clear } =
    useCartDraft(PREORDER_STORAGE_KEY);
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const [lastAddedLocalId, setLastAddedLocalId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [deposit, setDeposit] = useState<DepositDraft>(() => initialDepositDraft(cashDepositAvailable));

  // After the order is saved with a DP, the "BUKTI UANG MUKA" is what the
  // customer walks away with — this decides about the paper, then leaves.
  const { handleRecorded, prompt: depositPrompt } = useDepositReceiptPrompt({
    autoPrint: autoPrintReceipt,
    printerDriver,
    onFinished: () => {
      router.push("/pesanan-terjadwal");
      router.refresh();
    },
  });

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
      }),
    );
  }

  function handleTapCombo(item: Omit<CartItem, "localId">) {
    setSaveError(null);
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
    };

    // Same upsert as Kasir: a repeat customisation and an edit that ends up
    // identical to another line both merge instead of duplicating.
    const localId = upsertItem(item, sheetTarget.mode === "edit" ? sheetTarget.item.localId : null);
    setLastAddedLocalId(sheetTarget.mode === "edit" ? null : localId);
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
        deposit: deposit.amount > 0 ? { amount: deposit.amount, method: deposit.method } : null,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      clear();
      setCartSheetOpen(false);
      if (result.depositReceipt) {
        await handleRecorded(result.depositReceipt);
        return;
      }
      router.push("/pesanan-terjadwal");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const orderTotal = computeOrderTotals(draft.items, draft.channel).total;
  const depositExtra = (
    <div className="border-border mt-2 border-t pt-2">
      <p className="text-ink mb-1.5 text-sm font-bold">
        Uang Muka (DP) <span className="text-ink-faint font-normal">· Opsional</span>
      </p>
      <DepositPicker
        total={orderTotal}
        value={deposit}
        onChange={setDeposit}
        cashAvailable={cashDepositAvailable}
        allowNone
      />
    </div>
  );

  return (
    <div className="flex h-dvh flex-col">
      {depositPrompt}
      <AppHeader
        nav={nav}
        title="Pre-order Baru"
        actions={
          <LinkButton href="/pesanan-terjadwal" variant="secondary" size="compact">
            Batal
          </LinkButton>
        }
      />
      <div className="border-border bg-surface flex flex-wrap items-center gap-2 border-b px-3 py-2">
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

      <ChannelTableBar
        channel={draft.channel}
        tableLabel={draft.tableLabel}
        onChannel={setChannel}
        onTableLabel={setTableLabel}
        className="border-border bg-surface border-b px-3 py-1.5"
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
            footerExtra={depositExtra}
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
            footerExtra={depositExtra}
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
