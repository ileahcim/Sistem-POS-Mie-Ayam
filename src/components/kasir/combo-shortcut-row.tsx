"use client";

import { motion } from "motion/react";
import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { CartItem } from "@/lib/cart/types";
import type { ComboShortcut } from "@/lib/combo/types";
import { resolveComboShortcut } from "@/lib/combo/resolve-combo-shortcut";
import { PriceText } from "@/components/ui/price-text";
import { cartItemUnitTotal } from "@/lib/cart/types";

// "Menu Populer" — one-tap shortcuts for the current combo cache (either
// real 30-day top sellers or the 6 manual seed combos — see
// refresh-combo-cache.ts). Tapping adds the full product+add-on combo to
// the cart directly, skipping the addon sheet entirely — the whole point of
// a shortcut is fewer steps than building it by hand. Renders nothing if no
// shortcut currently resolves against the live menu (deactivated items) or
// the cache is empty.
export function ComboShortcutRow({
  shortcuts,
  categories,
  onTap,
}: {
  shortcuts: ComboShortcut[];
  categories: MenuCategory[];
  onTap: (item: Omit<CartItem, "localId">) => void;
}) {
  const resolved = shortcuts
    .map((s) => ({ shortcut: s, item: resolveComboShortcut(s, categories) }))
    .filter((r): r is { shortcut: ComboShortcut; item: Omit<CartItem, "localId"> } => r.item !== null);

  if (resolved.length === 0) return null;

  return (
    <div className="border-border bg-surface border-b px-3 py-2">
      <p className="text-ink-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">Menu Populer</p>
      <div className="flex gap-2 overflow-x-auto">
        {resolved.map(({ shortcut, item }) => (
          <motion.button
            key={shortcut.comboKey}
            type="button"
            onClick={() => onTap(item)}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="rounded-card bg-primary-soft flex min-h-14 shrink-0 flex-col items-start justify-center gap-0.5 px-4 py-2 text-left"
          >
            <span className="text-primary-strong text-sm font-bold leading-tight">{shortcut.displayName}</span>
            <PriceText amount={cartItemUnitTotal(item)} weight="secondary" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
